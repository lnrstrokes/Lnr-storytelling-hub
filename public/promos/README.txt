lnr Studio — Admin Promo Folder

Option A (Direct from Phone / PC — Zero Coding):
Open the app, tap the studio brand logo 7 times to open Admin Studio, unlock with your password,
and tap "Pick Promo Folder" or "Add Promo Files" to load videos directly into your Admin folder playlist
and choose how they display (Full Screen, Corner PiP, or Split Banner).

Option B (GitHub / Vercel Hosted Promos):
1. Place .mp4 or .webm promo videos inside this /public/promos/ folder.
2. List them in /public/promos/manifest.json like:
   {
     "clips": [
       { "name": "Sponsor Ad 1", "src": "/promos/sponsor1.mp4", "duration": 30 }
     ]
   }
3. Redeploy on Vercel and tap "Sync /promos/ Folder" inside Admin Studio.
