'use strict';
const menuButton=document.querySelector('.menu-button');
const navigation=document.querySelector('#navigation');
menuButton.addEventListener('click',()=>{const opened=menuButton.getAttribute('aria-expanded')==='true';menuButton.setAttribute('aria-expanded',String(!opened));navigation.classList.toggle('open',!opened);menuButton.setAttribute('aria-label',opened?'باز کردن فهرست':'بستن فهرست');});
navigation.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{navigation.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','باز کردن فهرست');}));
const dialog=document.querySelector('#demo-dialog');
document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#dialog-title').textContent=button.dataset.demo;dialog.showModal();}));
document.querySelectorAll('.dialog-close,.dialog-done').forEach(button=>button.addEventListener('click',()=>dialog.close()));
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
