#!/bin/bash

# Remote server IP address
SERVER_IP="192.168.1.233"

# SSH user
SSH_USER="user"

# Check if password was provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <password>"
    exit 1
fi

# SSH/SCP Password
PASSWORD="$1"

# Function to execute a command on the remote server using sshpass
execute_remote() {
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER_IP} "$1"
}

# Function to securely copy files to the remote server using sshpass
secure_copy() {
    sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no -r "$1" ${SSH_USER}@${SERVER_IP}:"$2"
}

# Kill any 'node' processes
execute_remote "pkill -f node"

# Copy server files to the remote server
secure_copy "./server/express.js" "/home/user/CODE/mpa/"
secure_copy "./server/package.json" "/home/user/CODE/mpa/"
secure_copy "./server/.env" "/home/user/CODE/mpa/"

# Copy client build files to the remote server
for file in ./client/build/*; do
    secure_copy "$file" "/var/www/html/mpa/"
done

# Modify JavaScript and CSS files to replace /static/ with /mpa/static/
execute_remote "find /var/www/html/mpa/ -type f \( -name 'index.html' \) -exec sed -i 's|/static/|/mpa/static/|g' {} \;"

execute_remote "find /var/www/html/mpa/ -type f \( -name '*.js' \) -exec sed -i 's|localhost|192.168.1.233|g' {} \;"

execute_remote "nohup bash /home/user/CODE/run.sh > /dev/null 2>&1 &"

echo "Files transferred successfully."
