# =============================================================================
# AlbionOS — Database & File Backup Script
# =============================================================================
# Schedule this script to run daily via Windows Task Scheduler.
# Example:
#   powershell.exe -File "C:\AlbionOS\scripts\backup.ps1"
# =============================================================================

param(
  [string]$BackupDir = "C:\AlbionOS\backups",
  [string]$SupabaseProjectRef = $(throw "Supabase project ref required"),
  [string]$SupabaseServiceKey = $(throw "Supabase service key required"),
  [int]$RetentionDays = 30
)

$DateStamp = Get-Date -Format "yyyyMMdd-HHmmss"

# ── 1. Database Backup via pg_dump ──
Write-Host "[Backup] Starting database backup..."
$DbBackupFile = Join-Path $BackupDir "db-$DateStamp.sql"

# Note: For Supabase, use the connection pooler string from Supabase Dashboard
# Settings → Database → Connection string (URI with password)
# Replace the placeholder below with your actual connection string.
$ConnString = "postgresql://postgres:$SupabaseServiceKey@db.$SupabaseProjectRef.supabase.co:5432/postgres"

pg_dump --no-owner --no-acl --clean --if-exists `
  -d $ConnString `
  -f $DbBackupFile

if ($LASTEXITCODE -eq 0) {
  Write-Host "[Backup] Database backup saved to: $DbBackupFile"

  # Compress the SQL dump to save space
  Compress-Archive -Path $DbBackupFile -DestinationPath "$DbBackupFile.zip" -CompressionLevel Optimal
  Remove-Item $DbBackupFile
  Write-Host "[Backup] Compressed to: $DbBackupFile.zip"
} else {
  Write-Error "[Backup] Database backup FAILED"
}

# ── 2. Clean Up Old Backups ──
$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "*.zip" | Where-Object {
  $_.CreationTime -lt $Cutoff
} | ForEach-Object {
  Remove-Item $_.FullName -Force
  Write-Host "[Backup] Deleted old backup: $($_.Name)"
}

# ── 3. Upload to Google Cloud Storage (if gsutil is installed) ──
$GcsBucket = "gs://albion-pharma-backups"
if (Get-Command "gsutil" -ErrorAction SilentlyContinue) {
  Write-Host "[Backup] Uploading to GCS bucket: $GcsBucket"
  gsutil cp "$DbBackupFile.zip" "$GcsBucket/daily/"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[Backup] Uploaded to GCS successfully"
  }
} else {
  Write-Host "[Backup] gsutil not found — skipping GCS upload"
}

Write-Host "[Backup] Completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
