import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Pet, PetImageRef, SavePetInput } from "./petTypes.js";
import type { PetPosition } from "../windows/petPositionStore.js";

/** The sole writable partner state. Task execution and history remain on the server. */
export class FrontendPetStore {
  private pets:Pet[]=[];
  private commands:Record<string,string>={};
  private initialized=false;
  private listeners=new Set<(pets:Pet[])=>void>();
  constructor(private readonly filePath:string, private readonly validateImportedImage?:(image:Extract<PetImageRef,{type:"imported"}>)=>void) {
    try {
      const value=JSON.parse(readFileSync(filePath,"utf8"));
      if(value.version!==1 || !Array.isArray(value.pets)) throw new Error("不支持的伙伴数据格式");
      this.validatePets(value.pets);
      this.pets=value.pets;this.commands=value.commands??{};this.initialized=true;
    } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
  }
  list():Pet[] {return structuredClone(this.pets);}
  get(id:string):Pet {const pet=this.pets.find(p=>p.id===id);if(!pet)throw new Error("伙伴不存在");return structuredClone(pet);}
  subscribe(listener:(pets:Pet[])=>void):()=>void {this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  initialize(workspaceId:string):void {
    if(this.initialized)return;
    const names=["八千代","小晴","团子","星河","阿墨","小麦","青竹","橙子","白露","海盐","小满","豆豆","山岚","松果","萤火","月白"];
    const timestamp=new Date().toISOString();
    const pets=names.map((name,index):Pet=>({
      id:randomUUID(),name,description:index===0?"桌面伙伴":"内置伙伴",
      rolePrompt:"根据用户的实际任务提供清晰、可靠的帮助。",
      revision:1,imageRef:{type:"builtin",id:"yachiyo"},isDefault:index===0,
      createdAt:timestamp,updatedAt:timestamp,workspaceId:index===0?workspaceId:null,
      threadId:null,visible:index===0,size:100,
    }));
    this.commit(pets);this.initialized=true;
  }
  save(input:SavePetInput,commandId?:string):Pet {
    if(commandId && this.commands[commandId])return this.get(this.commands[commandId]);
    if(!input || typeof input!=="object")throw new Error("无效伙伴资料");
    if(Object.keys(input).some(key=>!["id","expectedRevision","name","description","rolePrompt","imageRef"].includes(key)))throw new Error("无效伙伴字段");
    for(const key of ["name","rolePrompt"] as const) if(input[key]!==undefined && (typeof input[key]!=="string" || !input[key]!.trim()))throw new Error("名称和角色提示不能为空");
    if(input.description!==undefined && typeof input.description!=="string")throw new Error("无效伙伴描述");
    if(input.imageRef)this.validateImage(input.imageRef);
    const pets=this.list();const now=new Date().toISOString();
    let pet:Pet;
    if(input.id) {
      pet=pets.find(p=>p.id===input.id)!;if(!pet)throw new Error("伙伴不存在");
      if(input.expectedRevision!==pet.revision)throw new Error("伙伴已被修改，请刷新后重试");
      for(const key of ["name","description","rolePrompt"] as const)if(input[key]!==undefined)pet[key]=input[key]!.trim();
      if(input.imageRef)pet.imageRef=structuredClone(input.imageRef);
      pet.revision+=1;pet.updatedAt=now;
    } else {
      if(!input.name?.trim() || !input.rolePrompt?.trim())throw new Error("名称和角色提示不能为空");
      pet={id:randomUUID(),name:input.name.trim(),description:input.description?.trim()??"",rolePrompt:input.rolePrompt.trim(),
        imageRef:input.imageRef??{type:"builtin",id:"yachiyo"},revision:1,isDefault:false,createdAt:now,updatedAt:now,
        workspaceId:null,threadId:null,visible:false,size:100};
      pets.push(pet);
    }
    const commands={...this.commands,...(commandId?{[commandId]:pet.id}:{})};
    this.commit(pets,commands);return structuredClone(pet);
  }
  assign(petId:string,workspaceId:string,threadId:string|null,activate=true):Pet {
    const pets=this.list(),pet=pets.find(p=>p.id===petId);if(!pet)throw new Error("伙伴不存在");
    if(!workspaceId || typeof workspaceId!=="string" || !(threadId===null || typeof threadId==="string" && !!threadId))throw new Error("无效工作区或对话");
    const previous=threadId?pets.find(p=>p.threadId===threadId && p.id!==petId):undefined;
    if(previous?.visible)throw new Error("Thread 正在运行");
    if(!previous && pet.workspaceId===workspaceId && pet.threadId===threadId && (!activate || pet.visible))return structuredClone(pet);
    if(previous){previous.threadId=null;previous.updatedAt=new Date().toISOString();}
    pet.workspaceId=workspaceId;pet.threadId=threadId;if(activate)pet.visible=true;pet.updatedAt=new Date().toISOString();
    this.commit(pets);return structuredClone(pet);
  }
  open(workspaceId:string,threadId:string|null):Pet {
    const existing=threadId?this.pets.find(p=>p.threadId===threadId):undefined;
    if(existing)return this.assign(existing.id,workspaceId,threadId);
    const candidate=this.pets.find(p=>!p.visible);if(!candidate)throw new Error("没有隐藏伙伴，请新建 Pet");
    return this.assign(candidate.id,workspaceId,threadId);
  }
  summon(workspaceId:string):Pet {
    const hidden=this.pets.filter(p=>!p.visible);if(!hidden.length)throw new Error("没有隐藏伙伴，请新建 Pet");
    const pet=hidden[Math.floor(Math.random()*hidden.length)];
    return this.assign(pet.id,workspaceId,pet.workspaceId===workspaceId?pet.threadId:null);
  }
  show(id:string):Pet {const pet=this.get(id);if(!pet.workspaceId)throw new Error("请先选择工作区");return this.assign(id,pet.workspaceId,pet.threadId);}
  hide(id:string):void {this.updateState(id,pet=>{pet.visible=false;});}
  clearThread(threadId:string):void {const pets=this.list();for(const pet of pets)if(pet.threadId===threadId)pet.threadId=null;this.commit(pets);}
  setSize(id:string,size:number):void {if(!Number.isFinite(size)||size<50||size>150)throw new Error("无效伙伴大小");this.updateState(id,pet=>{pet.size=size;});}
  setPosition(id:string,position:PetPosition):void {if(!Number.isFinite(position.right)||!Number.isFinite(position.bottom))throw new Error("无效伙伴位置");this.updateState(id,pet=>{pet.position=position;});}
  private updateState(id:string,update:(pet:Pet)=>void):void {const pets=this.list(),pet=pets.find(p=>p.id===id);if(!pet)throw new Error("伙伴不存在");update(pet);pet.updatedAt=new Date().toISOString();this.commit(pets);}
  private validateImage(image:PetImageRef):void {
    if(image.type==="builtin" && image.id==="yachiyo")return;
    if(image.type==="imported" && ["image/png","image/jpeg","image/webp"].includes(image.mimeType) && typeof image.url==="string" && image.url.startsWith("data:"+image.mimeType+";base64,") && Number.isInteger(image.width) && image.width>0 && Number.isInteger(image.height) && image.height>0) {
      const encoded=image.url.slice(image.url.indexOf(',')+1);
      if(encoded.length>28*1024*1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error("图片过大或编码无效");
      const bytes=Buffer.from(encoded,"base64");
      if(!bytes.length || bytes.length>20*1024*1024)throw new Error("图片必须介于 1 byte 与 20 MiB");
      const valid=image.mimeType==="image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : image.mimeType==="image/jpeg" ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255 : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
      if(!valid)throw new Error("图片格式无效");
      this.validateImportedImage?.(image);return;
    }
    throw new Error("图片必须先成功导入");
  }
  private validatePets(pets:Pet[]):void {
    if(new Set(pets.map(p=>p.id)).size!==pets.length)throw new Error("伙伴身份重复");
    for(const pet of pets){
      if(typeof pet.id!=="string" || !pet.id || typeof pet.name!=="string" || typeof pet.description!=="string" || typeof pet.rolePrompt!=="string" || !Number.isInteger(pet.revision) || pet.revision<1 || typeof pet.visible!=="boolean" || typeof pet.isDefault!=="boolean" || !Number.isFinite(pet.size) || pet.size<50 || pet.size>150 || !(pet.workspaceId===null || typeof pet.workspaceId==="string" && !!pet.workspaceId) || !(pet.threadId===null || typeof pet.threadId==="string" && !!pet.threadId) || pet.threadId && !pet.workspaceId)throw new Error("伙伴数据损坏");
      this.validateImage(pet.imageRef);
    }
    const threads=pets.filter(p=>p.threadId).map(p=>p.threadId);
    if(new Set(threads).size!==threads.length || pets.some(p=>p.visible && !p.workspaceId))throw new Error("伙伴分配数据损坏");
  }
  private commit(pets:Pet[],commands=this.commands):void {
    this.validatePets(pets);
    const threads=pets.filter(p=>p.threadId).map(p=>p.threadId);
    if(new Set(threads).size!==threads.length)throw new Error("对话已关联其他伙伴");
    if(pets.some(p=>p.visible && !p.workspaceId))throw new Error("可见伙伴必须有工作区");
    mkdirSync(dirname(this.filePath),{recursive:true,mode:0o700});
    const temporary=this.filePath+".tmp";
    writeFileSync(temporary,JSON.stringify({version:1,pets,commands}),{mode:0o600});
    renameSync(temporary,this.filePath);this.pets=pets;this.commands=commands;
    for(const listener of this.listeners)listener(this.list());
  }
}
