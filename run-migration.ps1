# Loads .env.local, overrides DIRECT_URL to use port 5432 for direct migrations
$lines = Get-Content .env.local
foreach ($line in $lines) {
  if ($line -match "^([^=]+)=(.*)$") {
    $key = $Matches[1]; $val = $Matches[2]
    [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
  }
}
# Swap pooler port to direct port for migration
$direct = $env:DIRECT_URL -replace ":6543/", ":5432/"
$env:DIRECT_URL = $direct
npx prisma migrate dev --name add_creation_dust_and_lab_weekly
