import type { FrontendPetStore } from './pets/frontendPetStore.js';
import type { PetWindowCollection, PetAssignment } from './windows/petWindowCollection.js';
import type { PetImageRef, SavePetInput } from './pets/petTypes.js';
type IpcMain={handle(channel:string,handler:(event:{sender:unknown},...args:unknown[])=>unknown):unknown};
export type PickedPetImage={name:string;mimeType:string;bytesBase64:string};
/** Native capabilities are limited to registered management renderers. */
export function registerSettingsManagementIpc(ipcMain:IpcMain,options:{
  isManagementSender(sender:unknown):boolean;
  chooseDirectory():Promise<string|null>;chooseImage():Promise<PickedPetImage|null>;
  showPet(petId:string):Promise<void>;hidePet(petId:string):Promise<void>;getPetVisibility():Record<string,boolean>;
  store?:FrontendPetStore;allocation?:Pick<PetWindowCollection,'assignPet'|'openWorkspaceThread'|'summonPet'>;
  importPetImage?(image:PickedPetImage):PetImageRef;
}):void {
  const handlers:Record<string,(...args:any[])=>unknown>={
    'settings:choose-directory':()=>options.chooseDirectory(),'settings:choose-image':()=>options.chooseImage(),
    'settings:pet-visibility':()=>options.getPetVisibility(),
    'settings:show-pet':(id:string)=>options.showPet(id),'settings:hide-pet':(id:string)=>options.hidePet(id),
    'settings:list-pets':()=>options.store!.list(),
    'settings:save-pet':(input:SavePetInput,commandId?:string)=>options.store!.save(input,commandId),
    'settings:assign-pet':(input:PetAssignment)=>options.allocation!.assignPet(input),
    'settings:open-workspace-thread':(workspaceId:string,threadId:string|null)=>options.allocation!.openWorkspaceThread(workspaceId,threadId),
    'settings:summon-pet':(workspaceId:string)=>options.allocation!.summonPet(workspaceId),
    'settings:import-pet-image':(image:PickedPetImage)=>options.importPetImage!(image),
    'settings:set-pet-size':(petId:string,size:number)=>options.store!.setSize(petId,size),
  };
  const arities:Record<string,[number,number]>={'settings:choose-directory':[0,0],'settings:choose-image':[0,0],'settings:pet-visibility':[0,0],'settings:list-pets':[0,0],'settings:save-pet':[1,2],'settings:assign-pet':[1,1],'settings:open-workspace-thread':[2,2],'settings:summon-pet':[1,1],'settings:import-pet-image':[1,1],'settings:set-pet-size':[2,2],'settings:show-pet':[1,1],'settings:hide-pet':[1,1]};
  for(const [channel,action] of Object.entries(handlers))ipcMain.handle(channel,(event,...args)=>{
    if(!options.isManagementSender(event.sender))throw new Error('Invalid settings window sender');
    const [min,max]=arities[channel]!;
    if(args.length<min || args.length>max)throw new Error('Invalid settings request');
    if(['settings:show-pet','settings:hide-pet','settings:summon-pet','settings:set-pet-size','settings:open-workspace-thread'].includes(channel) && (typeof args[0]!=='string'||!args[0].trim()))throw new Error('Invalid pet management request');
    if(channel==='settings:assign-pet' && (!args[0] || typeof args[0]!=='object'))throw new Error('Invalid pet management request');
    return action(...args);
  });
}
