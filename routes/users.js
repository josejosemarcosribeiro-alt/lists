const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
require('dotenv').config();

// Model
let User = require('../models/user');

// --- Flash middleware ---
router.use((req, res, next) => {
  res.locals.flash = req.flash() || {};
  next();
});

/*
===========================
REGISTER - STEP 1 (EMAIL)
===========================
*/
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

    const userExists = await User.findOne({ email });
    if (userExists) {
      req.flash('danger', 'Email já cadastrado');
      return res.redirect('/users/register');
    }

    // GUARDA SOMENTE NA SESSÃO (NÃO CRIA NO BANCO AINDA)
    req.session.register = { email };

    res.redirect('/users/register/step2');
  } catch (err) {
    console.log(err);
    req.flash('danger', 'Erro no cadastro');
    res.redirect('/users/register');
  }
});

/*
===========================
REGISTER - STEP 2 (PASSWORD)
===========================
*/
router.get('/register/step2', (req, res) => {
  if (!req.session.register) return res.redirect('/users/register');
  res.render('register-step1');
});

router.post('/register/step2', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      req.flash('danger', 'Senha mínima de 6 caracteres');
      return res.redirect('/users/register/step2');
    }

    // Hash agora, mas só salva no final
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    req.session.register.password = hashedPassword;

    res.redirect('/users/register/step3');
  } catch (err) {
    console.log(err);
    res.redirect('/users/register/step2');
  }
});

/*
===========================
REGISTER - STEP 3 (NAME + USERNAME)
===========================
*/
router.get('/register/step3', (req, res) => {
  if (!req.session.register) return res.redirect('/users/register');
  res.render('register-name');
});

router.post('/register/step3', async (req, res) => {
  try {
    const { nomeCompleto, username } = req.body;

    if (!nomeCompleto || !username) {
      req.flash('danger', 'Todos os campos são obrigatórios');
      return res.redirect('/users/register/step3');
    }

    const user = new User({
      email: req.session.register.email,
      password: req.session.register.password,
      name: nomeCompleto,
      username: username
    });

    await user.save();

    // LIMPA A SESSÃO DE REGISTRO
    req.session.register = null;

    req.flash('success', 'Cadastro concluído! Faça login.');
    res.redirect('/users/login');
  } catch (err) {
    console.log(err);
    req.flash('danger', 'Erro ao finalizar cadastro');
    res.redirect('/users/register/step3');
  }
});

/*
===========================
LOGIN
===========================
*/
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

/*
===========================
LOGOUT
===========================
*/
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);

    req.session.destroy(() => {
      res.redirect('/users/login');
    });
  });
});

module.exports = router;
