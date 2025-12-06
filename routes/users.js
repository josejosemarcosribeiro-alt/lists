const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Models
let User = require('../models/user');

// --- Cloudinary config (opcional para avatar) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer + Cloudinary para upload de vídeo/avatar (opcional)
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'users',
    resource_type: 'auto',
    public_id: (req, file) => Date.now() + '-' + file.originalname
  }
});
const upload = multer({ storage });

// --- Flash middleware ---
router.use((req, res, next) => {
  res.locals.flash = req.flash() || {};
  next();
});

// --- Step 1: Email ---
router.get('/register', (req, res) => {
  res.render('register', { email: '' });
});

router.post('/register', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      req.flash('danger', 'Email obrigatório');
      return res.redirect('/users/register');
    }

    let user = await User.findOne({ email });
    if (user) {
      req.flash('danger', 'Email já cadastrado');
      return res.redirect('/users/register');
    }

    user = new User({ email });
    await user.save();
    req.session.userId = user._id;
    res.redirect('/users/register/step2');
  } catch (err) {
    console.log(err);
    req.flash('danger', 'Erro ao cadastrar');
    res.redirect('/users/register');
  }
});

// --- Step 2: Password ---
router.get('/register/step2', (req, res) => {
  if (!req.session.userId) return res.redirect('/users/register');
  res.render('register-step1');
});

router.post('/register/step2', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      req.flash('danger', 'Senha mínima 6 caracteres');
      return res.redirect('/users/register/step2');
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/users/register');

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    res.redirect('/users/register/step3');
  } catch (err) {
    console.log(err);
    res.redirect('/users/register/step2');
  }
});

// --- Step 3: Name & Username ---
router.get('/register/step3', (req, res) => {
  if (!req.session.userId) return res.redirect('/users/register');
  res.render('register-name');
});

router.post('/register/step3', async (req, res) => {
  try {
    const { nomeCompleto, username } = req.body;
    if (!nomeCompleto || !username) {
      req.flash('danger', 'Campos obrigatórios');
      return res.redirect('/users/register/step3');
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/users/register');

    user.name = nomeCompleto;
    user.username = username;
    await user.save();

    req.session.userId = null;
    req.flash('success', 'Cadastro concluído!');
    res.redirect('/users/login');
  } catch (err) {
    console.log(err);
    res.redirect('/users/register/step3');
  }
});

// --- LOGIN ---
router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/users/login',
    failureFlash: true
  })(req, res, next);
});

module.exports = router;
