#include <windows.h>
#include <d3d11.h>
#include <dwmapi.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <atomic>
#include <mutex>
#include <vector>
#include <iostream>
#include <chrono>

using namespace winrt;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX;

static bool WriteAll(const void* data, DWORD size)
{
    auto p = static_cast<const BYTE*>(data);
    while (size) { DWORD written = 0; if (!WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), p, size, &written, nullptr) || !written) return false; p += written; size -= written; }
    return true;
}

int CaptureWindow(HWND window, HWND content, UINT ow, UINT oh, UINT fps)
{
    try
    {
        init_apartment(apartment_type::multi_threaded);
        if (!GraphicsCaptureSession::IsSupported()) throw hresult_error(E_NOTIMPL);
        com_ptr<ID3D11Device> device;
        com_ptr<ID3D11DeviceContext> context;
        check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            nullptr, 0, D3D11_SDK_VERSION, device.put(), nullptr, context.put()));
        auto dxgi = device.as<IDXGIDevice>();
        com_ptr<IInspectable> inspectable;
        check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgi.get(), inspectable.put()));
        auto direct = inspectable.as<winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice>();
        auto factory = get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
        GraphicsCaptureItem item{ nullptr };
        check_hresult(factory->CreateForWindow(window, guid_of<GraphicsCaptureItem>(), put_abi(item)));
        auto size = item.Size();
        auto pool = Direct3D11CaptureFramePool::CreateFreeThreaded(direct, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size);
        auto session = pool.CreateCaptureSession(item);
        session.IsCursorCaptureEnabled(false);
        std::mutex mutex;
        std::atomic<bool> stopping = false;
        double nextFrameMs = 0;
        const double intervalMs = 1000.0 / fps;
        auto token = pool.FrameArrived([&](auto const& sender, auto const&)
        {
            std::lock_guard<std::mutex> guard(mutex);
            if (stopping) return;
            try
            {
                auto frame = sender.TryGetNextFrame();
                if (!frame) return;
                auto next = frame.ContentSize();
                if (next.Width != size.Width || next.Height != size.Height)
                {
                    frame.Close(); size = next;
                    if (size.Width > 0 && size.Height > 0) sender.Recreate(direct, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size);
                    return;
                }
                const double now = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
                if (now + 1.0 < nextFrameMs) return;
                nextFrameMs = max(nextFrameMs + intervalMs, now);
                auto access = frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
                com_ptr<ID3D11Texture2D> texture;
                check_hresult(access->GetInterface(__uuidof(ID3D11Texture2D), texture.put_void()));
                RECT outer{}, inner{};
                check_hresult(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS, &outer, sizeof(outer)));
                if (!GetWindowRect(content, &inner)) return;
                D3D11_TEXTURE2D_DESC desc{}; texture->GetDesc(&desc);
                const LONG left = max(0L, inner.left - outer.left), top = max(0L, inner.top - outer.top);
                const LONG width = min(static_cast<LONG>(desc.Width) - left, inner.right - inner.left);
                const LONG height = min(static_cast<LONG>(desc.Height) - top, inner.bottom - inner.top);
                if (width <= 0 || height <= 0) return;
                desc.Width = width; desc.Height = height; desc.Usage = D3D11_USAGE_STAGING;
                desc.BindFlags = 0; desc.MiscFlags = 0; desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
                com_ptr<ID3D11Texture2D> staging; check_hresult(device->CreateTexture2D(&desc, nullptr, staging.put()));
                D3D11_BOX box{ static_cast<UINT>(left), static_cast<UINT>(top), 0, static_cast<UINT>(left + width), static_cast<UINT>(top + height), 1 };
                context->CopySubresourceRegion(staging.get(), 0, 0, 0, 0, texture.get(), 0, &box);
                D3D11_MAPPED_SUBRESOURCE mapped{};
                check_hresult(context->Map(staging.get(), 0, D3D11_MAP_READ, 0, &mapped));
                // Preserve aspect ratio; only the WebView client enters the stream.
                std::vector<BYTE> pixels(ow * oh * 4);
                const double scale = min(static_cast<double>(ow) / width, static_cast<double>(oh) / height);
                const UINT dw = max(1U, static_cast<UINT>(width * scale)), dh = max(1U, static_cast<UINT>(height * scale));
                const UINT ox = (ow - dw) / 2, oy = (oh - dh) / 2;
                for (UINT y = 0; y < dh; ++y)
                    for (UINT x = 0; x < dw; ++x)
                        memcpy(&pixels[((y + oy) * ow + x + ox) * 4], static_cast<BYTE*>(mapped.pData) + (y * height / dh) * mapped.RowPitch + (x * width / dw) * 4, 4);
                context->Unmap(staging.get(), 0);
                const UINT header[] = { ow, oh, static_cast<UINT>(pixels.size()) };
                if (!WriteAll(header, sizeof(header)) || !WriteAll(pixels.data(), static_cast<DWORD>(pixels.size()))) stopping = true;
            }
            catch (hresult_error const& ex) { std::wcerr << L"VIDEO_ERROR " << ex.message().c_str() << std::endl; stopping = true; }
        });
        session.StartCapture();
        std::wcerr << L"READY VIDEO" << std::endl;
        char command; DWORD read;
        ReadFile(GetStdHandle(STD_INPUT_HANDLE), &command, 1, &read, nullptr);
        stopping = true;
        pool.FrameArrived(token);
        { std::lock_guard<std::mutex> guard(mutex); session.Close(); pool.Close(); }
        return 0;
    }
    catch (hresult_error const& ex) { std::wcerr << L"VIDEO_ERROR " << ex.message().c_str() << std::endl; return 1; }
}
