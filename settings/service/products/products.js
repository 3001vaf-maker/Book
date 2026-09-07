import { actionBlock, button, collectCost, collectWorkplaceSelections, costCardMeta, costField, costListParts, details, emptyState, entityCard, escapeHtml, field, iconButton, initCostFields, initPhotoField, initWorkplaceSelectors, listEntries, listEntry, mountModal, modal, page, pageHeader, photoField, textareaField, workplaceCountText, workplaceSelector } from '../../../ui/ui.js';
import { getWorkplaces } from '../../profile/workplaces/data.js';
import { deleteProduct as deleteProductData, getProducts, pushProductHistory, saveProduct as saveProductData } from './data.js';

function renderList(root,navigateBack){
  const items=getProducts();
  root.innerHTML=`<div class="entity-page-header">${pageHeader('Товары')}<div class="page-header-action">${iconButton('+',{data:'data-add-product',aria:'Добавить товар'})}</div></div>${items.length?listEntries(items.map(renderRow)):emptyState('Товаров пока нет','Добавьте первый товар кнопкой «+».')}${actionBlock(button('Назад',{className:'ui-button--secondary',data:'data-back-products'}))}`;
  root.querySelector('[data-add-product]')?.addEventListener('click',()=>openForm(root,null,navigateBack));
  root.querySelectorAll('[data-product]').forEach(el=>el.addEventListener('click',()=>renderCard(root,el.dataset.product,navigateBack)));
  root.querySelectorAll('[data-delete-action]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();confirmDelete(root,el.dataset.deleteAction,navigateBack,()=>renderList(root,navigateBack))}));
  root.querySelector('[data-back-products]')?.addEventListener('click',navigateBack);
}

function renderRow(p){
  const price=costListParts(p.cost),workplaceCount=(p.workplaces||[]).length;
  return listEntry({title:p.name||'',subtitle:workplaceCountText(workplaceCount),image:p.photo||'',initial:(p.name||'?').slice(0,1).toUpperCase(),rightTop:price.rightTop||'',rightBottom:price.rightBottom||'',interactive:true,data:`data-product="${escapeHtml(p.id)}"`,aria:`Открыть товар ${p.name||''}`,deleteData:p.id,deleteAria:`Удалить товар ${p.name||''}`});
}

function openForm(root,existing=null,navigateBack=()=>{}){
  const p=existing||{photo:'',name:'',cost:{mode:'amount',amount:'',free:false},about:'',workplaces:[]};
  const html=`<form class="compact-form" data-product-form><div class="modal-title"><h2>${existing?'Изменить товар':'Товар'}</h2></div>${photoField({name:'productPhoto',value:p.photo||''})}${field({label:'Название',name:'productName',value:p.name||'',placeholder:'Название товара',required:true})}${costField({value:p.cost||{},name:'productCost'})}${workplaceSelector({name:'productWorkplaces',selected:p.workplaces||[],allowMultiple:true,workplaces:getWorkplaces()})}${textareaField({label:'Описание',name:'productAbout',value:p.about||'',rows:7,maxlength:5000,placeholder:'Описание товара'})}${button('Сохранить',{type:'submit'})}</form>`;
  const m=mountModal(root,modal(html));
  initPhotoField(m);initCostFields(m);initWorkplaceSelectors(m);
  m.querySelector('[data-product-form]')?.addEventListener('submit',e=>{e.preventDefault();saveProduct(root,m,existing,navigateBack)});
}

function saveProduct(root,m,existing,navigateBack){
  const data=new FormData(m.querySelector('[data-product-form]'));const name=String(data.get('productName')||'').trim();if(!name)return;
  const item={id:existing?.id||crypto.randomUUID(),photo:String(data.get('productPhoto')||''),name,cost:collectCost(m,'productCost'),about:String(data.get('productAbout')||'').trim(),workplaces:collectWorkplaceSelections(m,'productWorkplaces'),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(existing)pushProductHistory(existing,'updated');saveProductData(item);m.remove();renderList(root,navigateBack);
}

function renderCard(root,id,navigateBack){
  const p=getProducts().find(x=>x.id===id);if(!p)return renderList(root,navigateBack);
  const workplaceNames=(p.workplaces||[]).map(w=>w.name||w.workplaceId).filter(Boolean);
  const card=entityCard({
    title:p.name||'',
    image:p.photo||'',
    initial:(p.name||'?').slice(0,1).toUpperCase(),
    topMeta:[{value:workplaceCountText(workplaceNames.length)}],
    topRightMeta:costCardMeta(p.cost),
    meta:workplaceNames.map(name=>({value:name})),
    metricsLayout:'vertical',
    className:'entity-card--hero entity-card--top-dark'
  });
  const info=details([
    p.about?{label:'Описание',value:p.about}:null,
    workplaceNames.length?{label:'Рабочие места',value:workplaceNames.join(', ')}:null
  ]);
  root.innerHTML=page([card,info,actionBlock(`${button('Редактировать товар',{data:'data-edit-product'})}${button('Назад',{className:'ui-button--secondary',data:'data-back-products-card'})}${button('Удалить',{variant:'danger',data:'data-delete-card'})}`)]);
  root.querySelector('[data-edit-product]').onclick=()=>openForm(root,p,navigateBack);
  root.querySelector('[data-delete-card]').onclick=()=>confirmDelete(root,id,navigateBack,()=>renderList(root,navigateBack));
  root.querySelector('[data-back-products-card]').onclick=()=>renderList(root,navigateBack);
}

function confirmDelete(root,id,navigateBack,onDeleted){
  const p=getProducts().find(x=>x.id===id);if(!p)return;
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(p.name||'Товар')} будет удалён.</p></div><div class="modal-actions">${button('Удалить',{variant:'danger',data:'data-confirm-delete'})}${button('Отмена',{className:'ui-button--secondary',data:'data-cancel-delete'})}</div>`,{variant:'compact'}));
  if(!m)return;
  m.querySelector('[data-cancel-delete]').onclick=()=>m.remove();
  m.querySelector('[data-confirm-delete]').onclick=()=>{if(deleteProductData(id)){m.remove();onDeleted?.()}else m.remove()};
}

export function renderProducts(root,navigateBack=()=>{}){renderList(root,navigateBack)}