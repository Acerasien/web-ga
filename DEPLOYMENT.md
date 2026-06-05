# Deployment Guide: Web_GA to VPS (Ubuntu Linux)

This guide documents the system requirements, software installation, database seeding, PM2 process management, and Nginx proxy server configurations needed to deploy the Web_GA tracking application online.

---

## 1. System Requirements

* **OS**: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS
* **CPU**: 1 vCPU
* **RAM**: 1 GB minimum (2 GB recommended to avoid compilation failures during `npm run build` or set up memory swap)
* **Storage**: 25 GB SSD minimum (increases with volume of receipt photo uploads)

---

## 2. Server Installation

Run the following commands on your freshly provisioned VPS:

```bash
# Update system repositories and upgrade active packages
sudo apt update && sudo apt upgrade -y

# 1. Install Node.js v20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PostgreSQL Database
sudo apt install postgresql postgresql-contrib -y

# 3. Install Nginx & Git Utilities
sudo apt install nginx git -y

# 4. Install PM2 Process Manager globally
sudo npm install pm2 -g
```

---

## 3. Database & Database User Configuration

Create a database and a dedicated user inside PostgreSQL:

```bash
# Enter the PostgreSQL prompt
sudo -i -u postgres psql
```

Run these SQL statements inside the prompt:
```sql
-- Create the tracking database
CREATE DATABASE web_ga_db;

-- Create the database user with a secure password
CREATE USER ga_user WITH PASSWORD 'your_secure_password';

-- Grant permissions to the user
GRANT ALL PRIVILEGES ON DATABASE web_ga_db TO ga_user;
ALTER DATABASE web_ga_db OWNER TO ga_user;

-- Exit the prompt
\q
```

---

## 4. Deploying & Building the Codebase

1. Clone the codebase to `/var/www/web-ga` and set correct user privileges:
   ```bash
   cd /var/www
   sudo git clone <YOUR_GIT_REPOSITORY_URL> web-ga
   sudo chown -R $USER:$USER /var/www/web-ga
   cd /var/www/web-ga/web-ga
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Create the Production Environment variables configuration:
   ```bash
   nano .env
   ```

   Paste and fill out the configuration:
   ```ini
   # Database connection configuration
   DATABASE_URL="postgresql://ga_user:your_secure_password@localhost:5432/web_ga_db?schema=public"

   # JSON Web Token secret signature key
   JWT_SECRET="generate_a_very_long_cryptographic_random_string_here"

   # Node Environment parameters
   NODE_ENV="production"
   PORT=3000

   # Public hostname address
   NEXT_PUBLIC_APP_URL="https://yourdomain.com"
   ```

4. Setup Database schema definitions and seed data:
   ```bash
   # Create the tables structure from schema.prisma
   npx prisma migrate deploy

   # Seed default categories, branch listing, and superadmin account details
   npx prisma db seed
   ```

5. Compile the production bundles:
   ```bash
   npm run build
   ```

6. Initialize the receipt upload directories and permissions:
   ```bash
   mkdir -p public/uploads/receipts
   chmod -R 775 public/uploads
   ```

---

## 5. Background Process Management (PM2)

Keep the Next.js application running in the background and configured to recover automatically after a VPS server reboot:

```bash
# Start Next.js using PM2
pm2 start npm --name "web-ga" -- start

# Configure system startup scripts
pm2 startup

# (Copy-paste the instruction command printed by PM2 on the terminal and run it)

# Save process list config
pm2 save
```

To manage the application process:
```bash
# View dashboard metrics
pm2 status

# Restart the process
pm2 restart web-ga

# View live output logs
pm2 logs web-ga
```

---

## 6. Nginx Reverse Proxy Configuration

Configure Nginx to proxy external web requests to Next.js (port 3000) and serve local receipt uploads directly.

1. Create a configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/web-ga
   ```

2. Paste the configuration below (replace `yourdomain.com` with your actual domain):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       # Serve static uploaded transaction receipts directly via Nginx
       location /uploads/ {
           alias /var/www/web-ga/web-ga/public/uploads/;
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }

       # Proxy all other request traffic to Next.js
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # Increase maximum upload file size to 10MB (for receipt photos/PDFs)
       client_max_body_size 10M;
   }
   ```

3. Enable the config, test, and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/web-ga /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 7. Configuring HTTPS (SSL) with Let's Encrypt

Provision free, automated SSL certificates via Certbot:

```bash
# Install Certbot utility
sudo apt install certbot python3-certbot-nginx -y

# Retrieve and configure SSL certificate inside Nginx configurations
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Select the option to automatically redirect all standard HTTP connections to secure HTTPS.
