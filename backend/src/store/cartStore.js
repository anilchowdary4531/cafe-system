import { create } from 'zustand';

export const useCart = create((set,get)=>(
    {
        items: [],
        add:(item)=>{
            const found=get().items.find(i=>i.id===item.id);
            if(found){
                set({items:get().items.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i)})
            }else{
                set({items:[...get().items,{...item,qty:1}]})
            }
        },
        remove:(id)=>set({items:get().items.filter(i=>i.id!==id)}),
        clear:()=>set({items:[]})
    }))