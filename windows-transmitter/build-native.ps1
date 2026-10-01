param([string]$Configuration = 'Release')
$ErrorActionPreference = 'Stop'
$nativePath = Join-Path $PSScriptRoot 'native-audio-capture'
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$msbuild = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
if (!$msbuild) { throw 'Instale as ferramentas C++ do Visual Studio 2022 ou posterior.' }
$nativeProject = Join-Path $nativePath 'ApplicationLoopback.vcxproj'
& $msbuild $nativeProject /t:Restore /p:RestorePackagesConfig=true "/p:RestoreRepositoryPath=$nativePath\packages" /v:minimal
if ($LASTEXITCODE) { throw 'Falha na restauração do capturador nativo.' }
& $msbuild $nativeProject "/p:Configuration=$Configuration" /p:Platform=x64 /v:minimal
if ($LASTEXITCODE) { throw 'Falha na compilação do capturador nativo.' }
