# MedPhys Reference Website

A ready-to-host static website containing the Timmerman normal-tissue constraint tables.

## Preview locally
Open `index.html` in a browser.

## Publish free with Netlify
1. Create a Netlify account.
2. Select **Add new site → Deploy manually**.
3. Drag the `medphys-reference-site` folder into the upload area.
4. Netlify will provide a public URL.

## Publish with GitHub Pages
1. Create a GitHub repository.
2. Upload all files in this folder.
3. Open **Settings → Pages**.
4. Publish from the main branch and root folder.

## Included features
- Search by organ, endpoint, and tissue type
- Organ and fraction filters
- Interactive dose-versus-fraction graph
- Volume information in graph hover labels
- Complication and contouring information
- Complete searchable table
- CSV download
- Responsive mobile layout

## Future expansion
For a multi-table production system, connect this public interface to a database such as Supabase and add a password-protected administrator dashboard for uploading and editing future tables.

## Clinical disclaimer
This site is a reference aid. Users must verify values against current publications, protocols, institutional policies, and clinical judgment.
