# 🚀 Deployment Guide for Rhythm Planner

## Step 1: Generate App Icons

1. Open `generate-icons.html` in your browser:
   - Double-click the file, or
   - Right-click → Open with → Chrome/Firefox/Edge

2. Click "Generate 192x192 Icon" button
   - Right-click on the canvas
   - Select "Save image as..."
   - Save as `icon-192.png` in the `public` folder

3. Click "Generate 512x512 Icon" button
   - Right-click on the canvas
   - Select "Save image as..."
   - Save as `icon-512.png` in the `public` folder

4. Delete the placeholder files (optional):
   ```bash
   rm public/icon-placeholder.svg
   rm generate-icons.html
   ```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI (Recommended)

1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from the project directory:
   ```bash
   cd "C:\Users\mrpof\APPS Homemade\rythym"
   vercel
   ```

4. Follow the prompts:
   - **Set up and deploy?** → Yes
   - **Which scope?** → Select your account
   - **Link to existing project?** → No
   - **Project name?** → rhythm-planner (or your choice)
   - **Directory?** → ./ (press Enter)
   - **Override settings?** → No

5. For production deployment:
   ```bash
   vercel --prod
   ```

### Option B: Deploy via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Click "Continue with GitHub" (or GitLab/Bitbucket)
4. Import your repository
5. Configure project:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
6. Click "Deploy"

### Option C: Deploy via Git (Automatic Deployments)

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Rhythm Planner"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/rhythm-planner.git
   git push -u origin main
   ```

3. Connect repository to Vercel:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Vercel will auto-detect Vite and configure settings
   - Click "Deploy"

4. Every push to `main` will auto-deploy! 🎉

## Step 3: Post-Deployment

### Verify Deployment

1. Open your Vercel URL (e.g., `https://rhythm-planner.vercel.app`)
2. Test on mobile:
   - Open Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M)
   - Test different screen sizes
3. Test PWA installation:
   - On mobile: Look for "Add to Home Screen" prompt
   - On desktop: Check for install icon in address bar

### Custom Domain (Optional)

1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed by Vercel

### Environment Variables (If Needed Later)

If you add backend features later:
1. Go to Vercel Dashboard → Your Project → "Settings" → "Environment Variables"
2. Add variables for each environment (Production, Preview, Development)

## Troubleshooting

### Build Fails
- Check `npm run build` works locally first
- Ensure all dependencies are in `package.json`
- Check Node version compatibility

### 404 on Routes
- Vercel should handle this automatically with `vercel.json`
- If issues persist, check the rewrites configuration

### Icons Not Showing
- Ensure `icon-192.png` and `icon-512.png` are in `public/` folder
- Clear browser cache and hard refresh (Ctrl+Shift+R)

## Production Checklist

- [x] Icons generated (192x192 and 512x512)
- [x] Build succeeds locally (`npm run build`)
- [x] Mobile responsive design tested
- [x] PWA manifest configured
- [ ] Test on real mobile devices
- [ ] Add custom domain (optional)
- [ ] Set up analytics (optional)

## Useful Commands

```bash
# Build locally
npm run build

# Preview production build
npm run preview

# Deploy to preview (Vercel)
vercel

# Deploy to production (Vercel)
vercel --prod

# Check deployment logs
vercel logs
```

## Next Steps After Deployment

1. Share your app URL with friends for testing
2. Test PWA installation on iOS and Android
3. Monitor performance with Vercel Analytics (free tier)
4. Consider adding:
   - Google Analytics
   - Error tracking (Sentry)
   - Performance monitoring
   - User feedback form

---

**Need help?** Check [Vercel Documentation](https://vercel.com/docs) or create an issue on GitHub.
