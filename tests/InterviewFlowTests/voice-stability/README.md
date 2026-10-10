Run from the repository root using .NET 10. The isolated output directory avoids overwriting a running development server:

```powershell
dotnet build tests/InterviewFlowTests/voice-stability/voice-stability.csproj --output .local/voice-stability-check-build
dotnet .local/voice-stability-check-build/voice-stability.dll
```

The harness exercises the actual speech service and settings with an in-process HTTP handler. It contacts no speech/video endpoint, creates no clips, changes no live kit, and spends no credits. It checks one selected voice across different clips, saved settings, unavailable TTS, pronunciation boundaries and precedence, invalid dictionaries, and preservation of original questions, answers and script.

It also mixes two generated tones with sharp peaks (1.8 s and 5 s) through the real mixer and checks they land at -14 LUFS. That check needs the local FFmpeg (`INTERVIEW_FFMPEG`, or the copy in `.local/interview-tools`) and is skipped when it is missing.
