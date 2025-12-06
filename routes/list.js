const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Models
let list_item = require('../models/listitem');
let User = require('../models/user');

// --- Cloudinary config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer + Cloudinary ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'videos',
    resource_type: 'video',
    format: async () => 'mp4',
    public_id: (req, file) => Date.now() + '-' + file.originalname
  }
});
const upload = multer({ storage });

// --- Flash middleware ---
router.use((req, res, next) => {
  res.locals.flash = req.flash() || {};
  next();
});

// --- Ensure Authenticated ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash('danger', 'Faça login');
  res.redirect('/users/login');
}

// --- ADD ITEM ---
router.get('/add', ensureAuthenticated, (req, res) => res.render('add_list'));
router.post('/add', ensureAuthenticated, upload.single('video'), async (req, res) => {
  try {
    const item = new list_item({
      title: req.body.title,
      author: req.user._id,
      body: req.body.body,
      videoPath: req.file ? req.file.path : null
    });
    await item.save();
    req.flash('success', 'Item criado');
    res.redirect('/');
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

// --- EDIT ITEM ---
router.get('/item/edit/:id', ensureAuthenticated, async (req, res) => {
  const item = await list_item.findById(req.params.id).lean();
  if (!item || item.author.toString() !== req.user._id.toString()) return res.redirect('/');
  res.render('edit_item', { item });
});

router.post('/edit/:id', ensureAuthenticated, upload.single('video'), async (req, res) => {
  const itemData = {
    title: req.body.title,
    body: req.body.body
  };
  if (req.file) itemData.videoPath = req.file.path;
  await list_item.updateOne({ _id: req.params.id }, itemData);
  res.redirect('/');
});

// --- VIEW ITEM ---
router.get('/item/:id', async (req, res) => {
  try {
    const item = await list_item.findById(req.params.id).lean();
    if (!item) return res.redirect('/');
    let authorName = 'Unknown';
    if (item.author) {
      const user = await User.findById(item.author).lean();
      if (user) authorName = user.name;
    }
    res.render('item', { item, author: authorName });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

// --- DELETE ITEM ---
router.delete('/item/:id', ensureAuthenticated, async (req, res) => {
  const item = await list_item.findById(req.params.id);
  if (!item || item.author.toString() !== req.user._id.toString()) return res.sendStatus(403);
  await list_item.deleteOne({ _id: req.params.id });
  res.send('Success');
});

module.exports = router;
