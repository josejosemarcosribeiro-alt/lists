const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// bring in models
let list_item = require('../models/listitem');
let User = require('../models/user');

// Configurar Cloudinary / Crodinario
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do Multer + Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'videos', // pasta onde vai salvar
        resource_type: 'video',
        format: async (req, file) => 'mp4', // forçando mp4
        public_id: (req, file) => Date.now() + '-' + file.originalname
    }
});

const upload = multer({ storage: storage });

// --- ROTAS ---

// Add new item
router.get('/add', ensureAuthenticated, function(req,res){
    res.render('add_list');
});

router.post('/add', ensureAuthenticated, upload.single('video'), function(req,res){
    req.checkBody('title','Title is required').notEmpty();
    req.checkBody('body','Body is required').notEmpty();

    let errors = req.validationErrors();
    if(errors){
        res.render('add_list', { errors: errors });
    } else {
        let item = new list_item();
        item.title = req.body.title;
        item.author = req.user._id;
        item.body = req.body.body;

        if(req.file){
            item.videoPath = req.file.path; // URL do Cloudinary/Crodinario
        }

        item.save(function(err){
            if(err){
                console.log(err);
                return;
            } else {
                req.flash('success','Listing Added!');
                // Observação: aqui podemos adicionar push / play do Crodinario
                res.redirect('/');
            }
        });
    }
});

// Edit item page
router.get('/item/edit/:id', ensureAuthenticated, function(req, res){
    list_item.findById(req.params.id, function(err, item){
        if(item.author != req.user._id){
            req.flash('danger','Not authenticated');
            res.redirect('/');
        } else {
            res.render('edit_item', { item: item });
        }
    });
});

// Edit item action
router.post('/edit/:id', ensureAuthenticated, upload.single('video'), function(req,res){
    let item = {};
    item.title = req.body.title;
    item.author = req.user._id;
    item.body = req.body.body;

    if(req.file){
        item.videoPath = req.file.path; // atualiza vídeo no Cloudinary
    }

    let query = {_id: req.params.id};
    list_item.updateOne(query, item, function(err){
        if(err){
            console.log(err);
            return;
        } else {
            req.flash('success','Listing Edited!');
            // Observação: aqui podemos adicionar push / play do Crodinario
            res.redirect('/');
        }
    });
});

// Get item
router.get('/item/:id', function(req, res){
    list_item.findById(req.params.id, function(err, item){
        if(err){ console.log(err); }
        else {
            User.findById(item.author, function(err, user){
                res.render('item', {
                    item: item,
                    author: user.name
                });
            });
        }
    });
});

// Delete item
router.delete('/item/:id', function(req,res){
    let query = {_id:req.params.id};
    if(!req.user._id){
        res.status(500).send();
    }
    list_item.findById(req.params.id, function(err, item){
        if(item.author != req.user._id){
            res.status(500).send();
        } else {
            list_item.remove(query, function(err){
                if(err) console.log(err);
                res.send('Success');
            });
        }
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
