const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔴 🔴 🔴 CANVIA AQUESTA LÍNIA! 🔴 🔴 🔴
const SHARED_DRIVE_ID = "0AJd_uxTCPmh0Uk9PVA"; // ← Posa aquí l’ID de la teva Shared Drive

const COURSE_NAMES = [
  "Infantil 3", "Infantil 4", "Infantil 5",
  "1r Primària", "2n Primària", "3r Primària", "4t Primària", "5è Primària", "6è Primària",
  "1r ESO", "2n ESO", "3r ESO", "4t ESO"
];

const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.use(express.static('.'));

const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/drive']
});

app.post('/upload', upload.array('photos'), async (req, res) => {
  const course = req.body.course;
  if (!course || !COURSE_NAMES.includes(course)) {
    return res.status(400).json({ error: 'Curs no vàlid.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No s’han rebut fitxers.' });
  }

  try {
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Cerca la carpeta del curs dins de la Shared Drive
    let folderId;
    const folderResponse = await drive.files.list({
      q: `name='${course}' and '${SHARED_DRIVE_ID}' in parents and trashed=false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name)'
    });

    if (folderResponse.data.files.length > 0) {
      folderId = folderResponse.data.files[0].id;
    } else {
      // Crea la carpeta si no existeix
      const folder = await drive.files.create({
        requestBody: {
          name: course,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [SHARED_DRIVE_ID]
        },
        supportsAllDrives: true,
        fields: 'id'
      });
      folderId = folder.data.id;
    }

    // Puja cada fitxer
    for (const file of req.files) {
      await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [folderId]
        },
        media: {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.path)
        },
        supportsAllDrives: true
      });
      fs.unlinkSync(file.path);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al pujar:', error);
    res.status(500).json({ error: 'Error intern del servidor.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor actiu a http://localhost:${PORT}`);
});