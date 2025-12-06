const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

// Models
let User = require('../models/user');

// Redirect /users/register to step 1
router.get('/register', (req, res) => {
    res.redirect('/users/register-step1');
});

// ==========================
// STEP 1 - EMAIL
// ==========================
router.get('/register-step1', (req, res) => {
    res.render('register', { email: req.session.signup?.email || '' });
});

router.post('/register-step1', async (req, res) => {
    const email = req.body.email?.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        req.flash('danger', 'O email é obrigatório!');
        return res.redirect('/users/register-step1');
    }

    if (!emailRegex.test(email)) {
        req.flash('danger', 'O email informado não é válido!');
        return res.redirect('/users/register-step1');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        req.flash('danger', 'Este email já está em uso!');
        return res.redirect('/users/register-step1');
    }

    req.session.signup = { email };
    res.redirect('/users/register-step2');
});

// ==========================
// STEP 2 - PASSWORD
// ==========================
router.get('/register-step2', (req, res) => {
    if (!req.session.signup || !req.session.signup.email) {
        return res.redirect('/users/register-step1');
    }
    res.render('register-step1'); // arquivo de senha
});

router.post('/register-step2', (req, res) => {
    const password = req.body.password?.trim();

    if (!req.session.signup || !req.session.signup.email) {
        req.flash('danger', 'Email não encontrado, comece novamente');
        return res.redirect('/users/register-step1');
    }

    if (!password || password.length < 6) {
        req.flash('danger', 'A senha é obrigatória e deve ter pelo menos 6 caracteres!');
        return res.redirect('/users/register-step2');
    }

    req.session.signup.password = password;
    res.redirect('/users/register-step3');
});

// ==========================
// STEP 3 - FULL NAME + USERNAME
// ==========================
router.get('/register-step3', (req, res) => {
    if (!req.session.signup || !req.session.signup.password) {
        return res.redirect('/users/register-step2');
    }
    res.render('register-name', {
        fullname: req.session.signup.fullname || '',
        username: req.session.signup.username || ''
    });
});

router.post('/register-step3', async (req, res) => {
    const fullname = req.body.fullname?.trim();
    const username = req.body.username?.trim();

    if (
        !fullname ||
        !username ||
        !req.session.signup ||
        !req.session.signup.email ||
        !req.session.signup.password
    ) {
        req.flash('danger', 'Todos os campos são obrigatórios!');
        return res.redirect('/users/register-step3');
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.session.signup.password, salt);

        const newUser = new User({
            nomeCompleto: fullname,
            username,
            email: req.session.signup.email,
            password: hashedPassword
        });

        await newUser.save();

        req.session.signup = null; // limpar sessão após salvar
        req.flash('success', 'Cadastro realizado com sucesso! Você já pode fazer login.');
        res.redirect('/users/login');
    } catch (err) {
        console.error('Erro registrando usuário:', err);
        req.flash('danger', 'Erro ao cadastrar usuário');
        res.redirect('/users/register-step1');
    }
});

// ==========================
// LOGIN / LOGOUT
// ==========================
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

router.get('/logout', (req, res) => {
    req.logout(function(err) {
        if(err){ return next(err); }
        req.flash('success', 'Você saiu com sucesso!');
        res.redirect('/users/login');
    });
});

module.exports = router;
