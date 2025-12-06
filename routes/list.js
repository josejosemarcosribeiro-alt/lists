const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Models
let list_item = require('../models/listitem');
let User = require('../models/user');

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer
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

// Flash seguro
router.use((req, res, next) => {
  res.locals.flash = req.flash() || {};
  next();
});

/* =========================
   CADASTRO EM 3 ETAPAS
========================= */

// Step 1
router.get('/register', (req, res) => {
  res.render('register', { email: '' });
});

router.post('/register', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      req.flash('danger', 'Email obrigatório');
      return res.redirect('/register');
    }

    let user = await User.findOne({ email });
    if (user) {
      req.flash('danger', 'Email já cadastrado');
      return res.redirect('/register');
    }

    user = new User({ email });
    await user.save();
    req.session.userId = user._id;

    res.redirect('/register/step2');
  } catch (err) {
    console.log(err);
    req.flash('danger', 'Erro ao cadastrar');
    res.redirect('/register');
  }
});

// Step 2
router.get('/register/step2', (req, res) => {
  if (!req.session.userId) return res.redirect('/register');
  res.render('register-step1');
});

router.post('/register/step2', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      req.flash('danger', 'Senha mínima 6 caracteres');
      return res.redirect('/register/step2');
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/register');

    user.password = password;
    await user.save();

    res.redirect('/register/step3');
  } catch (err) {
    console.log(err);
    res.redirect('/register/step2');
  }
});

// Step 3
router.get('/register/step3', (req, res) => {
  if (!req.session.userId) return res.redirect('/register');
  res.render('register-name');
});

router.post('/register/step3', async (req, res) => {
  try {
    const { nomeCompleto, username } = req.body;
    if (!nomeCompleto || !username) {
      req.flash('danger', 'Campos obrigatórios');
      return res.redirect('/register/step3');
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/register');

    user.name = nomeCompleto;
    user.username = username;
    await user.save();

    req.session.userId = null;
    req.flash('success', 'Cadastro concluído!');
    res.redirect('/users/login');
  } catch (err) {
    console.log(err);
    res.redirect('/register/step3');
  }
});

/* =========================
   LISTAGEM
========================= */

router.get('/add', ensureAuthenticated, (req, res) => {
  res.render('add_list');
});

router.post('/add', ensureAuthenticated, upload.single('video'), (req, res) => {
  const item = new list_item();
  item.title = req.body.title;
  item.author = req.user._id;
  item.body = req.body.body;

  if (req.file) item.videoPath = req.file.path;

  item.save(err => {
    if (err) {
      console.log(err);
      return res.redirect('/');
    }
    req.flash('success', 'Item criado');
    res.redirect('/');
  });
});

// EDIT
router.get('/item/edit/:id', ensureAuthenticated, async (req, res) => {
  const item = await list_item.findById(req.params.id);
  if (!item) return res.redirect('/');

  if (item.author.toString() !== req.user._id.toString())
    return res.redirect('/');

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

// VIEW ITEM ✅ CORRIGIDO
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

// DELETE
router.delete('/item/:id', ensureAuthenticated, async (req, res) => {
  const item = await list_item.findById(req.params.id);
  if (!item) return res.sendStatus(403);

  if (item.author.toString() !== req.user._id.toString())
    return res.sendStatus(403);

  await list_item.deleteOne({ _id: req.params.id });
  res.send('Success');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash('danger', 'Faça login');
  res.redirect('/users/login');
}

module.exports = router;
