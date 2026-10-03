import { PetManager as SharedPetManager } from "../../../thread-window-web/src/components/PetManager.tsx";
import type { PetCommand } from "../../../thread-window-web/src/components/PetManager.tsx";
import type { PetThreadController } from "./petThreadController.ts";

export function PetManager({controller,threadURL,onClose}:{controller:PetThreadController;threadURL:string;onClose():void}) {
  const command: PetCommand = (type,payload,commandId) => {
    if (type !== "pet.create" && type !== "pet.update" && type !== "pet.image.import") return Promise.reject(new Error("未知伙伴操作"));
    return controller.command(type,payload as Record<string,unknown>,commandId);
  };
  return <div className="pet-popover pet-manager" data-pet-interactive>
    <SharedPetManager pets={controller.store.getState().pets} command={command} threadURL={threadURL} bridge={window.handAgentSettings} onClose={onClose}/>
  </div>;
}
