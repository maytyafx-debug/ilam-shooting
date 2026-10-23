'use strict';
const menuButton=document.querySelector('.menu-button');
const navigation=document.querySelector('#navigation');
menuButton.addEventListener('click',()=>{const opened=menuButton.getAttribute('aria-expanded')==='true';menuButton.setAttribute('aria-expanded',String(!opened));navigation.classList.toggle('open',!opened);menuButton.setAttribute('aria-label',opened?'باز کردن فهرست':'بستن فهرست');});
navigation.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{navigation.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','باز کردن فهرست');}));
