import { element } from './controls.js';
import { presets } from '../physics/ensemble.js';
const input=id=>/** @type {HTMLInputElement} */(element(id));
export function readDomain() {
  return {center1:Number(input('center1').value),center2:Number(input('center2').value),span1:Number(input('span1').value),span2:Number(input('span2').value)};
}
export function setupAngleDomain() {
  input('domain-preset').addEventListener('change',()=>{
    const domain=presets[input('domain-preset').value];
    if(domain)for(const key of ['center1','center2','span1','span2'])input(key).value=String(domain[key]);
  });
  for(const id of ['center1','center2','span1','span2'])input(id).addEventListener('input',()=>{input('domain-preset').value='custom';});
}
