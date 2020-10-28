import { ServiceId } from "./service"
import { IInstantiationService } from "./instantiation-service"

export const CURRENT_INJECTOR = Symbol("CurrentInjector")

export class InjectorResolutionError extends Error {
    constructor(public cause: string) {
        super(`Injector resolution erro: ${cause}`)
    }
}

export function inject<T>(serviceId: ServiceId<T>){
    return function(proto: unknown, propName:string){
        Object.defineProperty(proto, propName, {
            get(){
                let injector = (this as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                if(!injector){
                    injector = (proto as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                }
                if(!injector){
                    throw new InjectorResolutionError("Please only use @inject when service is instantialized by InstantiationService.")
                }
                return injector.get(serviceId)()
            }
        })
    }
}

export function injectOptional<T>(serviceId: ServiceId<T>){
    return function(proto: unknown, propName:string){
        Object.defineProperty(proto, propName, {
            get(){
                const injector = (proto as Record<typeof CURRENT_INJECTOR, unknown>)[CURRENT_INJECTOR] as IInstantiationService
                return injector.get(serviceId)()
            }
        })
    }
}