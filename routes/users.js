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

// Step 1 - Register form (email)
router.get('/register-step1', (req, res) => {
    res.render('register'); // register.pug que só pede email
});

// Step 1 - POST email
router.post('/register-step1', (req, res) => {
    const { email } = req.body;
    if (!email) {
        req.flash('error', 'Email is required');
        return res.redirect('/users/register-step1');
    }
    req.session.signup = { email };
    res.redirect('/users/register-step2');
});

// Step 2 - Register form (password)
router.get('/register-step2', (req, res) => {
    if (!req.session.signup || !req.session.signup.email) {
        return res.redirect('/users/register-step1');
    }
    res.render('register-step1'); // register-step1.pug que pede senha
});

// Step 2 - POST password
router.post('/register-step2', (req, res) => {
    const { password } = req.body;
    if (!password) {
        req.flash('error', 'Password is required');
        return res.redirect('/users/register-step2');
    }
    if (!req.session.signup) req.session.signup = {};
    req.session.signup.password = password;
    res.redirect('/users/register-step3');
});

// Step 3 - Register form (fullname + username)
router.get('/register-step3', (req, res) => {
    if (!req.session.signup || !req.session.signup.password) {
        return res.redirect('/users/register-step2');
    }
    res.render('register-name'); // register-name.pug
});

// Step 3 - POST fullname + username and create user
router.post('/register-step3', (req, res) => {
    const { fullname, username } = req.body;
    const { email, password } = req.session.signup;

    // Validate inputs
    req.checkBody('fullname', 'Full Name is required').notEmpty();
    req.checkBody('username', 'Username is required').notEmpty();
    req.checkBody('password', 'Password is required').notEmpty();
    req.checkBody('email', 'Email is required').notEmpty();
    req.checkBody('email', 'Email is not valid').isEmail();

    let errors = req.validationErrors();
    if (errors) {
        return res.render('register-name', { errors });
    }

    let newUser = new User({
        name: fullname,
        username,
        email,
        password
    });

    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(newUser.password, salt, function (err, hash) {
            if (err) {
                console.log(err);
                req.flash('error', 'Error creating user');
                return res.redirect('/users/register-step1');
            }
            newUser.password = hash;
            newUser.save(function (err) {
                if (err) {
                    console.log(err);
                    req.flash('error', 'Error saving user');
                    return res.redirect('/users/register-step1');
                } else {
                    req.session.signup = null; // limpar sessão após salvar
                    req.flash('success', 'You are registered and can login!');
                    res.redirect('/users/login');
                }
            });
        });
    });
});

// login form
router.get('/login', (req, res) => {
    res.render('login');
});

// login process
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res, next);
});

// logout
router.get('/logout', (req, res) => {
    req.logout();
    req.flash('success', 'You are now logged out!');
    res.redirect('/users/login');
});

module.exports = router;
