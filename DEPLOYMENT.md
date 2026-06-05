# VPS Deployment Guide: Co-hosting Web_GA alongside Psychology Platform

Since your VPS is already running the **Psychology Testing Platform** (using Node.js, Nginx, and PostgreSQL), you do not need to install these tools again. Instead, we will configure **Web_GA** to run side-by-side with the existing project.

---

## 🗄️ 1. Database Configuration (Co-existence)

PostgreSQL runs on port `5432` and can handle multiple databases and users simultaneously. We will create a new database `web_ga_db` and user `ga_user` on the existing Postgres service.

Log in to the PostgreSQL CLI on your VPS:
```bash
sudo -u postgres psql
```

Run these SQL statements to create the database resources (use a strong alphanumeric password, e.g., `gaAdmin2026SecurePass`):
```sql
-- Create a new separate database
CREATE DATABASE web_ga_db;

-- Create a new database user
CREATE USER ga_user WITH PASSWORD 'gaAdmin2026SecurePass';

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE web_ga_db TO ga_user;
ALTER DATABASE web_ga_db OWNER TO ga_user;

-- Exit the psql prompt
\q
```

---

## 📂 2. Cloning & Preparing the Project

1. Create a dedicated folder for the project:
   ```bash
   sudo mkdir -p /var/www/web-ga
   sudo chown -R $USER:$USER /var/www/web-ga
   ```

2. Clone the repository into this folder:
   ```bash
   git clone https://github.com/Acerasien/web-ga /var/www/web-ga
   cd /var/www/web-ga/web-ga
   ```

3. Install project dependencies:
   ```bash
   npm install
   ```

4. Create the production environment variables file:
   ```bash
   nano .env
   ```

   Paste and save this configuration:
   ```ini
   # PostgreSQL database connection pointing to the new database
   DATABASE_URL="postgresql://ga_user:gaAdmin2026SecurePass@localhost:5432/web_ga_db?schema=public"

   # JWT secret signature key (generate a unique secure key)
   JWT_SECRET="--generate-a-secure-32-byte-hex-key--"

   # Node server configurations
   NODE_ENV="production"
   PORT=3000

   # Your target domain URL for Web_GA
   NEXT_PUBLIC_APP_URL="https://webga.andamas.id"
   ```
   *(To generate a secure JWT_SECRET key, run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).*

5. Create tables structure and seed default data (creates default superadmin user, branches, and categories):
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

6. Compile the Next.js production build:
   ```bash
   npm run build
   ```

7. Prepare uploads directory:
   ```bash
   mkdir -p public/uploads/receipts
   chmod -R 775 public/uploads
   ```

---

## ⚙️ 3. Process Management (PM2)

PM2 is a production process manager that keeps Node.js applications running in the background. Since Node is already installed, we can run the Next.js production server side-by-side with your Python backend:

```bash
# Start the Next.js production server using PM2
pm2 start npm --name "web-ga" -- start

# Save the process state so it automatically spins up on server restart
pm2 save
```

To monitor both running projects:
```bash
# View all active background processes
pm2 status

# View logs for Web_GA
pm2 logs web-ga
```

---

## 🌐 4. Nginx Reverse Proxy Configuration

Nginx handles virtual hosts (`server_name`). We will map a new domain (e.g. `webga.andamas.id`) to proxy requests to port `3000` (Next.js), leaving `psikotest.andamas.id` untouched on port `8000`.

1. Create a new Nginx block configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/web-ga
   ```

2. Paste the following configuration (replace `webga.andamas.id` with your actual DNS subdomain name):
   ```nginx
   server {
       listen 80;
       server_name webga.andamas.id;

       # Serve static uploaded transaction receipts directly via Nginx
       location /uploads/ {
           alias /var/www/web-ga/web-ga/public/uploads/;
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }

       # Proxy all other request traffic to Next.js running on Port 3000
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
   # Enable our new site configuration
   sudo ln -s /etc/nginx/sites-available/web-ga /etc/nginx/sites-enabled/

   # Test config syntax (make sure both sites compile successfully)
   sudo nginx -t

   # Reload Nginx server
   sudo systemctl restart nginx
   ```

---

## 🔒 5. Configuring HTTPS (SSL)

Once your DNS A-record (e.g. `webga.andamas.id`) is pointing to your VPS public IP address, run Certbot to automatically retrieve and configure your SSL certificate:

```bash
sudo certbot --nginx -d webga.andamas.id
```

Select the option to automatically redirect all standard HTTP connections to secure HTTPS.

---

## 🔄 6. Maintenance & Updates

To deploy updates from GitHub to the production server:

```bash
cd /var/www/web-ga/web-ga
git pull origin main

# Update packages & run migrations if models changed
npm install
npx prisma migrate deploy

# Recompile and restart the Next.js process
npm run build
pm2 restart web-ga
```
