// ApplicationLoopback.cpp : This file contains the 'main' function. Program execution begins and ends there.
//

#include <Windows.h>
#include <iostream>
#include "LoopbackCapture.h"
int CaptureWindow(HWND window, HWND content, UINT width, UINT height, UINT fps);

void usage()
{
    std::wcout <<
        L"Usage: ApplicationLoopback <pid> <includetree|excludetree> <outputfilename>\n"
        L"\n"
        L"<pid> is the process ID to capture or exclude from capture\n"
        L"includetree includes audio from that process and its child processes\n"
        L"excludetree includes audio from all processes except that process and its child processes\n"
        L"<outputfilename> is the WAV file to receive the captured audio (10 seconds)\n"
        L"\n"
        L"Examples:\n"
        L"\n"
        L"ApplicationLoopback 1234 includetree CapturedAudio.wav\n"
        L"\n"
        L"  Captures audio from process 1234 and its children.\n"
        L"\n"
        L"ApplicationLoopback 1234 excludetree CapturedAudio.wav\n"
        L"\n"
        L"  Captures audio from all processes except process 1234 and its children.\n";
}

int wmain(int argc, wchar_t* argv[])
{
    if (argc == 7 && wcscmp(argv[1], L"--video") == 0)
    {
        const UINT width = wcstoul(argv[4], nullptr, 10), height = wcstoul(argv[5], nullptr, 10), fps = wcstoul(argv[6], nullptr, 10);
        if (width < 320 || width > 1920 || height < 240 || height > 1080 || width % 2 || height % 2 || (fps != 30 && fps != 60)) return 2;
        return CaptureWindow(reinterpret_cast<HWND>(_wcstoui64(argv[2], nullptr, 10)), reinterpret_cast<HWND>(_wcstoui64(argv[3], nullptr, 10)), width, height, fps);
    }
    if (argc != 4)
    {
        usage();
        return 2;
    }

    DWORD processId = wcstoul(argv[1], nullptr, 0);
    if (processId == 0)
    {
        usage();
        return 2;
    }

    bool includeProcessTree;
    if (wcscmp(argv[2], L"includetree") == 0)
    {
        includeProcessTree = true;
    }
    else
    {
        usage();
        return 2;
    }

    PCWSTR outputFile = argv[3];

    CLoopbackCapture loopbackCapture;
    HRESULT hr = loopbackCapture.StartCaptureAsync(processId, includeProcessTree, outputFile);
    if (FAILED(hr))
    {
        wil::unique_hlocal_string message;
        FormatMessageW(FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS | FORMAT_MESSAGE_ALLOCATE_BUFFER, nullptr, hr,
            MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT), (PWSTR)&message, 0, nullptr);
        std::wcerr << L"Failed to start capture\n0x" << std::hex << hr << L": " << message.get() << L"\n";
        return 1;
    }
    else
    {
        std::wcerr << L"READY 48000 2 16" << std::endl;
        if (wcscmp(outputFile, L"-") == 0)
        {
            // A closed control pipe also ends capture if the parent exits.
            char command;
            DWORD read = 0;
            ReadFile(GetStdHandle(STD_INPUT_HANDLE), &command, 1, &read, nullptr);
        }
        else Sleep(10000);

        loopbackCapture.StopCaptureAsync();

        std::wcerr << L"Finished.\n";
    }

    return 0;
}
