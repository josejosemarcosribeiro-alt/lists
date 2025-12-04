const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

// bring in models
let User = require('../models/user');

// Redirect /users/register to step 1
router.get('/register', (req, res) => {
    res.redirect('/users/register-step1');
});

// ==========================
// STEP 1 - EMAIL
// ==========================
router.get('/register-step1', (req, res) => {
    res.render('register'); // register.pug que pede só email
});

router.post('/register-step1', (req, res) => {
    const { email } = req.body;

    if (!email) {
        req.flash('error', 'Email is required');
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

    res.render('register-step1'); // Aqui, se seu arquivo de senha for outro, substitua pelo nome correto
});

router.post('/register-step2', (req, res) => {
    const { password } = req.body;

    if (!req.session.signup || !req.session.signup.email) {
        req.flash('error', 'Email not found, please start again');
        return res.redirect('/users/register-step1');
    }

    if (!password) {
        req.flash('error', 'Password is required');
        return res.redirect('/users/register-step2');
    }

    req.session.signup.password = password;
    res.redirect('/users/register-step3');
});

// ==========================
// STEP 3 - NAME + USERNAME
// ==========================
router.get('/register-step3', (req, res) => {
    if (!req.session.signup || !req.session.signup.password) {
        return res.redirect('/users/register-step2');
    }

    res.render('register-name'); // register-name.pug
});

router.post('/register-step3', async (req, res) => {
    const { fullname, username } = req.body;

    if (
        !fullname ||
        !username ||
        !req.session.signup ||
        !req.session.signup.email ||
        !req.session.signup.password
    ) {
        req.flash('error', 'All fields are required');
        return res.redirect('/users/register-step3');
    }

    const email = req.session.signup.email;
    const password = req.session.signup.password;

    try {
        let newUser = new User({
            name: fullname,
            username,
            email,
            password
        });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newUser.password, salt);
        newUser.password = hash;

        await newUser.save();

        req.session.signup = null; // limpar sessão após salvar
        req.flash('success', 'You are registered and can login!');
        res.redirect('/users/login');
    } catch (err) {
        console.log(err);
        req.flash('error', 'Registration failed');
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
    req.logout();
    req.flash('success', 'You are now logged out!');
    res.redirect('/users/login');
});

module.exports = router;
