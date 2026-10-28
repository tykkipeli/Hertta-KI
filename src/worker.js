import {decide} from './ai.js';
self.onmessage=e=>{try{self.postMessage({id:e.data.id,...decide(e.data.observation,{milliseconds:e.data.milliseconds})});}catch(error){self.postMessage({id:e.data.id,error:String(error)});}};
