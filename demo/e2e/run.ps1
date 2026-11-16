# BusinessVault — end-to-end check against the live deployment.
#
# Proves, on the real site and the real database:
#   1. account creation
#   2. three bill images uploaded straight to storage
#   3. the model files each one without a human choosing a category
#   4. an oversized file (6 MB) is accepted
#   5. a pack is built for a period with a note
#   6. the pack opens and has the right folders
#   7. a human correction wins over the model
#
# Usage:  powershell -File demo/e2e/run.ps1 [-Base https://...]

param(
  [string]$Base = "https://business-vault-liart.vercel.app"
)

$ErrorActionPreference = "Stop"
$script:pass = 0
$script:fail = 0
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$bills = Join-Path $root "demo\bills\out"

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  if ($ok) {
    $script:pass++
    Write-Host ("[PASS] {0} {1}" -f $name, $detail) -ForegroundColor Green
  } else {
    $script:fail++
    Write-Host ("[FAIL] {0} {1}" -f $name, $detail) -ForegroundColor Red
  }
}

function Api([string]$method, [string]$path, $body, $session) {
  $req = @{
    Uri         = "$Base$path"
    Method      = $method
    ContentType = "application/json"
    WebSession  = $session
    UseBasicParsing = $true
  }
  if ($null -ne $body) { $req.Body = ($body | ConvertTo-Json -Compress) }
  try {
    Invoke-WebRequest @req
  } catch {
    Write-Host ("  API {0} {1} -> {2}" -f $method, $path, $_.ErrorDetails.Message) -ForegroundColor DarkYellow
    throw
  }
}

Write-Host "`nBusinessVault E2E against $Base`n" -ForegroundColor Cyan

# 1. account
$email = "e2e-$([guid]::NewGuid().ToString('N').Substring(0,10))@sharmatraders.test"
$signup = Api "POST" "/api/auth/sign-up" @{
  email = $email; password = "demo12345"; fullName = "E2E Run"; businessName = "E2E Traders"
} $null
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Api "POST" "/api/auth/sign-in" @{ email = $email; password = "demo12345" } $session | Out-Null
Check "account created and signed in" ($session.Cookies.Count -gt 0) $email

# 2-3. upload bills, one at a time, measuring the model
$expected = @{
  "cloudtools-invoice.png"     = @{ category = "Purchase Invoice"; amount = 2499 }
  "bescom-electricity.png"     = @{ category = "Utility Bill"; amount = 4860 }
  "sharma-properties-rent.png" = @{ category = "Expense"; amount = 35000 }
}

$uploaded = @()
foreach ($file in $expected.Keys) {
  $path = Join-Path $bills $file
  $target = (Api "POST" "/api/documents/signed-url" @{ filename = $file; documentDate = "" } $session).Content | ConvertFrom-Json
  $put = curl.exe -s -o NUL -w "%{http_code}" -X PUT -H "Content-Type: image/png" -H "x-upsert: false" --data-binary "@$path" "$($target.signedUrl)"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $commit = (Api "POST" "/api/documents/commit" @{
    storagePath = $target.storagePath; originalFilename = $file; mimeType = "image/png"
    fileSize = (Get-Item $path).Length; category = "Other"; documentDate = ""
  } $session).Content | ConvertFrom-Json
  $sw.Stop()
  $doc = $commit.document
  $uploaded += $doc
  $want = $expected[$file]
  Check "read $file" ($doc.category -eq $want.category -and $doc.amount -eq $want.amount) `
    "($($doc.category), Rs$($doc.amount), $([math]::Round($sw.Elapsed.TotalSeconds,1))s, conf $($doc.confidence))"
}

# 3b. a PDF is read from its own text layer, not its filename
$pdfPath = Join-Path $root "sample-data\sample-02-electricity-bill.pdf"
$pdfTarget = (Api "POST" "/api/documents/signed-url" @{ filename = "sample-02-electricity-bill.pdf"; documentDate = "" } $session).Content | ConvertFrom-Json
$pdfPut = curl.exe -s -o NUL -w "%{http_code}" -X PUT -H "Content-Type: application/pdf" --data-binary "@$pdfPath" "$($pdfTarget.signedUrl)"
$pdfCommit = (Api "POST" "/api/documents/commit" @{
  storagePath = $pdfTarget.storagePath; originalFilename = "sample-02-electricity-bill.pdf"; mimeType = "application/pdf"
  fileSize = (Get-Item $pdfPath).Length; category = "Other"; documentDate = ""
} $session).Content | ConvertFrom-Json
$pd = $pdfCommit.document
Check "reads a PDF from its text layer" ($pd.category -eq "Utility Bill" -and $pd.documentDate -eq "2026-10-18") `
  "($($pd.category), $($pd.documentDate), Rs$($pd.amount), conf $($pd.confidence))"

# 3c. a text file: an exported bank/UPI alert
$txtPath = Join-Path $env:TEMP "hdfc-upi-alert.txt"
"Rs.2,499.00 debited from A/c XX4412 on 04-08-26 to V/CLOUDTOOLS IN. UPI Ref 413622889901." | Set-Content -Path $txtPath -Encoding ASCII -NoNewline
$txtTarget = (Api "POST" "/api/documents/signed-url" @{ filename = "hdfc-upi-alert.txt"; documentDate = "" } $session).Content | ConvertFrom-Json
$txtPut = curl.exe -s -o NUL -w "%{http_code}" -X PUT -H "Content-Type: text/plain" --data-binary "@$txtPath" "$($txtTarget.signedUrl)"
$txtCommit = (Api "POST" "/api/documents/commit" @{
  storagePath = $txtTarget.storagePath; originalFilename = "hdfc-upi-alert.txt"; mimeType = "text/plain"
  fileSize = (Get-Item $txtPath).Length; category = "Other"; documentDate = ""
} $session).Content | ConvertFrom-Json
$td = $txtCommit.document
Check "reads a .txt bank alert" ($td.category -eq "Payment Proof" -and $td.amount -eq 2499) `
  "($($td.category), $($td.documentDate), Rs$($td.amount))"

# 4. oversized file through the direct path
$big = Join-Path $env:TEMP "e2e-big.pdf"
$bytes = New-Object byte[] (6 * 1024 * 1024)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$hdr = [Text.Encoding]::ASCII.GetBytes("%PDF-1.4")
[Array]::Copy($hdr, $bytes, $hdr.Length)
[IO.File]::WriteAllBytes($big, $bytes)

$bigTarget = (Api "POST" "/api/documents/signed-url" @{ filename = "e2e-big.pdf"; documentDate = "" } $session).Content | ConvertFrom-Json
$bigPut = curl.exe -s -o NUL -w "%{http_code}" -X PUT -H "Content-Type: application/pdf" -H "x-upsert: false" --data-binary "@$big" "$($bigTarget.signedUrl)"
$bigCommit = (Api "POST" "/api/documents/commit" @{
  storagePath = $bigTarget.storagePath; originalFilename = "e2e-big.pdf"; mimeType = "application/pdf"
  fileSize = (Get-Item $big).Length; category = "Other"; documentDate = "2026-08-20"
} $session).Content | ConvertFrom-Json
Check "6 MB file accepted" ($bigPut -eq "200" -and $bigCommit.document.id) "PUT $bigPut"

# 4b. a file that lies about its type must be rejected
$fake = Join-Path $env:TEMP "e2e-fake.pdf"
[IO.File]::WriteAllBytes($fake, (New-Object byte[] 4096))
$fakeTarget = (Api "POST" "/api/documents/signed-url" @{ filename = "e2e-fake.pdf"; documentDate = "" } $session).Content | ConvertFrom-Json
curl.exe -s -o NUL -X PUT -H "Content-Type: application/pdf" --data-binary "@$fake" "$($fakeTarget.signedUrl)" | Out-Null
$rejected = $false
try {
  Api "POST" "/api/documents/commit" @{
    storagePath = $fakeTarget.storagePath; originalFilename = "e2e-fake.pdf"; mimeType = "application/pdf"
    fileSize = 4096; category = "Other"; documentDate = ""
  } $session | Out-Null
} catch { $rejected = $true }
Check "a file that lies about its type is rejected" $rejected

# 5. collect
$note = "electricity bill, rent receipt, purchase invoices"
$job = (Api "POST" "/api/collect" @{
  from = "2026-08-01"; to = "2026-08-31"; minAmount = $null; maxAmount = $null; note = $note
} $session).Content | ConvertFrom-Json
Check "collect answers the note" ($job.job.checklist.Count -ge 3) `
  "included=$($job.job.counts.included) review=$($job.job.counts.needsReview)"

$rentItem = $job.job.items | Where-Object { $_.filename -eq "sharma-properties-rent.png" }
Check "the read amount reaches the pack" ($rentItem.amount -eq 35000) "amount=$($rentItem.amount)"
foreach ($row in $job.job.checklist) {
  Check "  checklist: $($row.label)" ($row.status -ne "missing") $row.status
}

# 6. pack
$zipPath = Join-Path $env:TEMP "e2e-pack.zip"
$zipBody = @{ from = "2026-08-01"; to = "2026-08-31"; minAmount = $null; maxAmount = $null; note = $note; download = $true } | ConvertTo-Json -Compress
Invoke-WebRequest -Uri "$Base/api/collect" -Method POST -ContentType "application/json" -Body $zipBody -WebSession $session -OutFile $zipPath -UseBasicParsing
$zipOk = (Get-Item $zipPath).Length -gt 1000
Check "pack downloaded" $zipOk "$([math]::Round((Get-Item $zipPath).Length/1KB)) KB"

$outDir = Join-Path $env:TEMP "e2e-pack-out"
Remove-Item $outDir -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zipPath -DestinationPath $outDir -Force
$names = Get-ChildItem $outDir -Recurse -File | ForEach-Object { $_.FullName.Substring($outDir.Length + 1) }
Check "pack has a folder per category" ($names -match "Purchase Invoice" -and $names -match "Utility Bill") ($names -join ", ")

# 7. review queue holds only what could not be read (the random 6 MB PDF)
$review = (Api "GET" "/api/review" $null $session).Content | ConvertFrom-Json
$unread = @($review.documents | Where-Object { $_.category -eq "Other" })
Check "only unread files are in review" ($review.documents.Count -eq $unread.Count) "count=$($review.documents.Count)"

# 8. a human correction wins
$first = $uploaded[0]
$patched = (Api "PATCH" "/api/documents/$($first.id)" @{
  category = "Receipt"; documentDate = "2026-08-05"; amount = 1111
} $session).Content | ConvertFrom-Json
Check "human correction wins" ($patched.document.category -eq "Receipt" -and $patched.document.classifiedBy -eq "human") `
  "$($patched.document.category), Rs$($patched.document.amount)"

Write-Host ("`n{0} passed, {1} failed`n" -f $script:pass, $script:fail) -ForegroundColor $(if ($script:fail -eq 0) { "Green" } else { "Red" })
if ($script:fail -gt 0) { exit 1 }
