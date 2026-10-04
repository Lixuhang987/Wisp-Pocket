import { useEffect, useState } from 'react';
import { PetManager as SharedPetManager } from '../../../thread-window-web/src/components/PetManager.tsx';
import { WorkspaceThreadPicker } from '../../../thread-window-web/src/components/WorkspaceThreadPicker.tsx';
import type { Pet } from '../../../thread-window-web/src/native/petTypes.ts';
import { makeThreadWindowStore } from '../../../thread-window-web/src/store/threadWindowStore.ts';
import { ThreadSocketClient } from '../../../thread-window-web/src/thread/threadSocketClient.ts';
import type { PetThreadController } from './petThreadController.ts';

export function PetManager({controller,threadURL,assignOnly,onClose}:{controller:PetThreadController;threadURL:string;assignOnly?:boolean;onClose():void}) {
  const [store] = useState(makeThreadWindowStore);
  const workspaces = store(state=>state.workspaces), threads = store(state=>state.history);
  const [pets,setPets] = useState<Pet[]>([]);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  useEffect(()=>{
    const bridge=window.handAgentSettings;
    let active=true;
    const dispose=bridge?.onPetsChanged(value=>{if(active)setPets(value);});
    void bridge?.listPets().then(value=>{if(active)setPets(value);}).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:'伙伴加载失败');});
    const client=new ThreadSocketClient({url:threadURL,listWorkspaces:true,onConnectionState:()=>{},onRequest:()=>{},onNotification:store.getState().handleNotification});
    client.connect();
    return()=>{active=false;dispose?.();client.disconnect();};
  },[store,threadURL]);
  return <div className="pet-popover pet-manager" data-pet-interactive>
    {assignOnly ? <WorkspaceThreadPicker workspaces={workspaces} threads={threads} busy={busy} onCancel={onClose} onSelect={(workspaceId,threadId)=>{
      if(!window.handAgentSettings){setError('桌宠窗口暂不可用');return;}
      setBusy(true);setError('');void window.handAgentSettings.assignPet({petId:controller.petId,workspaceId,threadId}).then(onClose).catch(failure=>setError(failure instanceof Error?failure.message:'选择失败')).finally(()=>setBusy(false));
    }}/> : <SharedPetManager pets={pets} workspaces={workspaces} threads={threads} bridge={window.handAgentSettings} onClose={onClose}/>}
    {error&&<p role="alert" className="settings-error">{error}</p>}
  </div>;
}
