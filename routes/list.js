const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Models
let list_item = require('../models/listitem');
let User = require('../models/user');

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração Multer + Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'videos',
        resource_type: 'video',
        format: async (req, file) => 'mp4',
        public_id: (req, file) => Date.now() + '-' + file.originalname
    }
});
const upload = multer({ storage: storage });

// --- Middleware para flash seguro ---
router.use((req, res, next) => {
    res.locals.flash = req.flash() || {};
    next();
});

// --- ROTAS DE CADASTRO EM 3 ETAPAS ---
// Etapa 1: E-mail
router.get('/register', (req,res) => {
    res.render('register', { email: '' });
});

router.post('/register', async (req,res) => {
    try {
        const { email } = req.body;
        if(!email) {
            req.flash('danger','Email é obrigatório');
            return res.redirect('/register');
        }

        let user = await User.findOne({ email });
        if(user){
            req.flash('danger','Email já cadastrado');
            return res.redirect('/register');
        }

        // Cria usuário parcial
        user = new User({ email });
        await user.save();

        // Salva id do usuário na sessão para etapas seguintes
        req.session.userId = user._id;

        res.redirect('/register/step2');
    } catch(err){
        console.log(err);
        req.flash('danger','Erro ao salvar e-mail');
        res.redirect('/register');
    }
});

// Etapa 2: Senha
router.get('/register/step2', (req,res) => {
    if(!req.session.userId){
        return res.redirect('/register');
    }
    res.render('register-step1');
});

router.post('/register/step2', async (req,res) => {
    try {
        const { password } = req.body;
        if(!password || password.length < 6){
            req.flash('danger','Senha deve ter no mínimo 6 caracteres');
            return res.redirect('/register/step2');
        }

        let user = await User.findById(req.session.userId);
        if(!user){
            req.flash('danger','Usuário não encontrado');
            return res.redirect('/register');
        }

        user.password = password; // versão simples
        await user.save();

        res.redirect('/register/step3');
    } catch(err){
        console.log(err);
        req.flash('danger','Erro ao salvar senha');
        res.redirect('/register/step2');
    }
});

// Etapa 3: Nome e username
router.get('/register/step3', (req,res) => {
    if(!req.session.userId){
        return res.redirect('/register');
    }
    res.render('register-name');
});

router.post('/register/step3', async (req,res) => {
    try {
        const { nomeCompleto, username } = req.body;
        if(!nomeCompleto || !username){
            req.flash('danger','Todos os campos são obrigatórios');
            return res.redirect('/register/step3');
        }

        let user = await User.findById(req.session.userId);
        if(!user){
            req.flash('danger','Usuário não encontrado');
            return res.redirect('/register');
        }

        user.name = nomeCompleto;
        user.username = username;
        await user.save();

        // Limpa session temporária
        req.session.userId = null;

        req.flash('success','Cadastro concluído! Faça login.');
        res.redirect('/users/login');
    } catch(err){
        console.log(err);
        req.flash('danger','Erro ao salvar dados');
        res.redirect('/register/step3');
    }
});

// --- ROTAS EXISTENTES DE LIST/ITEM/VÍDEO ---
// Add new item
router.get('/add', ensureAuthenticated, (req,res) => {
    res.render('add_list');
});

router.post('/add', ensureAuthenticated, upload.single('video'), (req,res) => {
    req.checkBody('title','Title is required').notEmpty();
    req.checkBody('body','Body is required').notEmpty();

    let errors = req.validationErrors();
    if(errors){
        res.render('add_list', { errors });
    } else {
        let item = new list_item();
        item.title = req.body.title;
        item.author = req.user ? req.user._id : null;
        item.body = req.body.body;

        if(req.file){
            item.videoPath = req.file.path; // URL do Cloudinary
        }

        item.save(err => {
            if(err){
                console.log(err);
                return;
            } else {
                req.flash('success','Listing Added!');
                res.redirect('/');
            }
        });
    }
});

// Edit item page
router.get('/item/edit/:id', ensureAuthenticated, (req, res) => {
    list_item.findById(req.params.id, (err, item) => {
        if(err || !item){
            req.flash('danger','Item not found');
            return res.redirect('/');
        }
        if(!req.user || item.author.toString() != req.user._id.toString()){
            req.flash('danger','Not authenticated');
            return res.redirect('/');
        }
        res.render('edit_item', { item });
    });
});

// Edit item action
router.post('/edit/:id', ensureAuthenticated, upload.single('video'), (req,res) => {
    let itemData = {
        title: req.body.title,
        author: req.user ? req.user._id : null,
        body: req.body.body
    };

    if(req.file){
        itemData.videoPath = req.file.path; // atualiza vídeo
    }

    list_item.updateOne({_id:req.params.id}, itemData, err => {
        if(err){
            console.log(err);
            return;
        } else {
            req.flash('success','Listing Edited!');
            res.redirect('/');
        }
    });
});

// Get item
router.get('/item/:id', (req, res) => {
    list_item.findById(req.params.id, (err, item) => {
        if(err || !item){
            console.log(err);
            return res.redirect('/');
        }

        let authorName = 'Unknown';
        if(item.author){
            User.findById(item.author, (err, user) => {
                if(user) authorName = user.name;
                res.render('item', { item, author: authorName });
            });
        } else {
            res.render('item', { item, author: authorName });
        }
    });
});

// Delete item
router.delete('/item/:id', (req,res) => {
    if(!req.user || !req.user._id){
        return res.status(500).send();
    }

    list_item.findById(req.params.id, (err, item) => {
        if(err || !item){
            return res.status(500).send();
        }
        if(item.author.toString() != req.user._id.toString()){
            return res.status(500).send();
        }
        list_item.deleteOne({_id:req.params.id}, err => {
            if(err) console.log(err);
            res.send('Success');
        });
    });
});

// --- Função de autenticação ---
function ensureAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return next();
    } else {
        req.flash('danger','Please login');
        res.redirect('/users/login');
    }
}

module.exports = router;
