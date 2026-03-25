try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://127.0.0.1:8081/")
    $listener.Start()
    Write-Host "Server started on http://127.0.0.1:8081"

    $root = "C:\Users\TortugaMarina\Documents\AntiGravity"

    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $resp = $ctx.Response
        $path = $req.Url.LocalPath

        try {
            if ($path -eq "/") { $path = "/index.html" }

            $file = Join-Path $root $path.TrimStart("/")

            if (Test-Path $file -PathType Leaf) {
                $bytes = [IO.File]::ReadAllBytes($file)
                $ext = [IO.Path]::GetExtension($file)
                $ct = switch ($ext) {
                    ".html" { "text/html" }
                    ".js" { "application/javascript" }
                    ".css" { "text/css" }
                    ".png" { "image/png" }
                    ".jpg" { "image/jpeg" }
                    ".webp" { "image/webp" }
                    ".json" { "application/json" }
                    ".mp4" { "video/mp4" }
                    ".mp3" { "audio/mpeg" }
                    ".svg" { "image/svg+xml" }
                    ".glb" { "model/gltf-binary" }
                    default { "application/octet-stream" }
                }
                $resp.ContentType = $ct
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                $resp.StatusCode = 404
                $bytes = [Text.Encoding]::UTF8.GetBytes("Not Found: $path")
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
        catch {
            # Ignore client disconnections
        }
        finally {
            try { $resp.OutputStream.Close() } catch {}
        }
    }
}
catch {
    Write-Host "Server Error: $_"
}
finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
    }
}
