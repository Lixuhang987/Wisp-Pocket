import { vi } from 'vitest';
import type { Pet, SavePetInput } from '../../../thread-window-web/src/native/petTypes.ts';
import type { PetManagementBridge } from '../../../thread-window-web/src/native/settingsBridge.ts';

export function petFixture(id='pet-default',workspaceId='workspace-default',threadId:string|null=null): Pet {
  return {id,name:'月见八千代',description:'',rolePrompt:'Help',revision:1,imageRef:{type:'builtin',id:'yachiyo'},isDefault:true,createdAt:'2026',updatedAt:'2026',workspaceId,threadId,visible:true,size:100};
}
/** 本机宿主边界替身；Thread 仍经真实客户端和 store 处理。 */
export function installPetBridge(initial: Pet[]) {
  let pets=initial;
  const listeners=new Set<(pets:Pet[])=>void>();
  const publish=(next:Pet[])=>{pets=next;for(const listener of listeners)listener(pets);};
  const bridge:PetManagementBridge={
    listPets:async()=>pets,
    onPetsChanged:handler=>{listeners.add(handler);handler(pets);return()=>{listeners.delete(handler);};},
    assignPet:vi.fn(async input=>{
      const current=pets.find(p=>p.id===input.petId);
      if(input.expected && (current?.workspaceId!==input.expected.workspaceId||current?.threadId!==input.expected.threadId))return;
      publish(pets.map(p=>p.id===input.petId?{...p,workspaceId:input.workspaceId,threadId:input.threadId,visible:input.activate===false?p.visible:true}:p));
    }),
    savePet:vi.fn(async (input:SavePetInput)=>{const previous=pets.find(p=>p.id===input.id);const next={...petFixture(input.id??'new-pet'),...previous,...input,revision:(previous?.revision??0)+1,workspaceId:previous?.workspaceId??null,threadId:previous?.threadId??null,visible:previous?.visible??false};publish([...pets.filter(p=>p.id!==next.id),next]);return next;}),
    openWorkspaceThread:async()=>{},summonPet:vi.fn(async()=>{}),importPetImage:async()=>({type:'builtin',id:'yachiyo'}),
    setPetSize:vi.fn(async(id,size)=>{publish(pets.map(p=>p.id===id?{...p,size}:p));}),
    showPet:async(id)=>{publish(pets.map(p=>p.id===id?{...p,visible:true}:p));},hidePet:async(id)=>{publish(pets.map(p=>p.id===id?{...p,visible:false}:p));},
  };
  window.handAgentSettings=bridge;
  return {bridge,publish,getPets:()=>pets};
}
