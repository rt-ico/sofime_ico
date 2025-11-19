# PowerShell equivalent of the bash script
# Original: rsync -vP -e "ssh -p 2002" --filter="+ *.tar" --filter="- *" reflexe@jenkins.reflexe.fr:/home/reflexe/scenario/sofime_scenario_001.tar podman-postgres/

# Since PowerShell doesn't have rsync built-in, we'll use SCP with the -r (recursive) flag
# Note: You may need to install OpenSSH or use another method like pscp (PuTTY SCP)

# Define the parameters
$remoteUser = "reflexe"
$remoteServer = "jenkins.reflexe.fr"
$remotePort = 2002
$remotePath = "/home/reflexe/scenario/sofime_scenario_001.tar"
$localPath = ".\podman-postgres\"

# Ensure the local directory exists
if (-not (Test-Path -Path $localPath)) {
    New-Item -ItemType Directory -Path $localPath -Force
}

# Use SCP to download the tar file
# If OpenSSH is installed:
Write-Host "Downloading tar file from remote server..."
scp -P $remotePort "${remoteUser}@${remoteServer}:${remotePath}" $localPath

# Alternative if you're using PuTTY's PSCP:
# & 'C:\path\to\pscp.exe' -P $remotePort "${remoteUser}@${remoteServer}:${remotePath}" $localPath

# Run podman-compose up
Write-Host "Starting podman-compose..."
podman-compose up
