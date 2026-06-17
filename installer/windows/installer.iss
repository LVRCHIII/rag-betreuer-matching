; Inno Setup Script – BHT Betreuer-Matching
; Verpackt die PyInstaller-Ausgabe (dist\BetreuerMatching\) in eine Setup.exe.
;
; Bauen:
;   1. Frontend bauen:           cd frontend && npm run build
;   2. App einfrieren:           pyinstaller installer\launcher.spec --noconfirm
;   3. Installer kompilieren:    iscc installer\windows\installer.iss
;   -> Ergebnis: installer\output\BetreuerMatching-Setup.exe
;
; Inno Setup installieren (auf der Build-Maschine):  winget install JRSoftware.InnoSetup

#define AppName "BHT Betreuer-Matching"
#define AppVersion "1.0.0"
#define AppPublisher "BHT – Gruppe 02"
#define AppExeName "BetreuerMatching.exe"
; DistDir kann per ISCC /DDistDir=... als absoluter Pfad übergeben werden.
; Das vermeidet "..\.."-Einschübe, die unter Windows das MAX_PATH-Limit (260)
; bei tief verschachtelten torch-Dateien sprengen. Fallback: relativ zur .iss.
#ifndef DistDir
  #define DistDir "..\..\dist\BetreuerMatching"
#endif

[Setup]
AppId={{8F2C5A11-3D4E-4B6A-9C7D-A1B2C3D4E5F6}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\BetreuerMatching
DefaultGroupName=BHT Betreuer-Matching
DisableProgramGroupPage=yes
OutputDir=..\output
OutputBaseFilename=BetreuerMatching-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Keine Admin-Rechte erzwingen – pro-Benutzer-Installation möglich
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "{#DistDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\BHT Betreuer-Matching"; Filename: "{app}\{#AppExeName}"
Name: "{group}\{cm:UninstallProgram,BHT Betreuer-Matching}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\BHT Betreuer-Matching"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,BHT Betreuer-Matching}"; Flags: nowait postinstall skipifsilent

[Code]
// Beim Start prüfen, ob Ollama installiert ist, und ansonsten einen Hinweis zeigen.
function OllamaInstalled(): Boolean;
var
  FindRec: TFindRec;
begin
  Result := FileExists(ExpandConstant('{localappdata}\Programs\Ollama\ollama.exe'))
            or FileExists(ExpandConstant('{pf}\Ollama\ollama.exe'))
            or FileExists(ExpandConstant('{commonpf}\Ollama\ollama.exe'));
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ErrCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    if not OllamaInstalled() then
    begin
      if MsgBox('Für die KI-Antworten wird "Ollama" benötigt, das noch nicht installiert scheint.'
        + #13#10#13#10 + 'Jetzt die Ollama-Download-Seite im Browser öffnen?'
        + #13#10 + '(Nach der Installation dort einmalig ausführen:  ollama pull llama3)',
        mbConfirmation, MB_YESNO) = IDYES then
      begin
        ShellExec('open', 'https://ollama.com/download', '', '', SW_SHOW, ewNoWait, ErrCode);
      end;
    end;
  end;
end;
