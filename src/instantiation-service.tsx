import * as React from "react"
import { createServiceId, ServiceId } from "./service"
import { CURRENT_INJECTOR } from "./inject"

export interface IDisposable {
    dispose(): void
}


export interface IInstantiationService {
    parent?: IInstantiationService
    get<T>(serviceId: ServiceId<T>): () => T | null
    provide<T, Args extends any[]>(serviceId: ServiceId<T>, impl: new (...args: Args) => T, ...args: Args): (node: React.ReactNode) => React.ReactElement
}

export class InstantiationService implements IDisposable, IInstantiationService {
    static useNewNode() {
        const parent = React.useContext(IInstantiationService.context)
        const inster = React.useMemo(() => {
            const res = new InstantiationService()
            res.parent = parent() || undefined
            return res
        }, [])
        React.useEffect(()=>()=>{
            inster.dispose()
        },[])
        return inster
    }
    provide<T, Args extends any[]>(serviceId: ServiceId<T>, impl: new (...args: Args) => T, ...args: Args) {
        return (node: React.ReactNode) => {
            node = <serviceId.context.Provider value={this.registerService(serviceId, impl, args)}>{node}</serviceId.context.Provider>
            return <>{node}</>
        }
    }
    private instanceMap = new Map<ServiceId, IDisposable & { [CURRENT_INJECTOR]: InstantiationService }>()
    private bindingMap = new Map<ServiceId, () => IDisposable & { [CURRENT_INJECTOR]: InstantiationService }>()
    public parent?: IInstantiationService
    dispose() {
        for (const inst of this.instanceMap.values()) {
            inst.dispose?.()
        }
    }
    registerService<T, Arg extends any[]>(serviceId: ServiceId<T>, Impl: new (...args: Arg) => T, args: Arg): () => T {
        let lazyBinding = (this.bindingMap.get(serviceId as ServiceId) as unknown) as () => T
        if (!this.bindingMap.has(serviceId as ServiceId)) {
            lazyBinding = ((() => {
                if (this.bindingMap.has(serviceId as ServiceId)) {
                    if (this.instanceMap.has(serviceId as ServiceId)) {
                        return this.instanceMap.get(serviceId as ServiceId)
                    }
                    /*
                     * 在proto上临时设置injector以给constructor里提供injector
                     */
                    Impl.prototype[CURRENT_INJECTOR] = this
                    const inst = (new Impl(...args) as unknown) as IDisposable & { [CURRENT_INJECTOR]: InstantiationService }
                    delete Impl.prototype[CURRENT_INJECTOR]
                    inst[CURRENT_INJECTOR] = this
                    this.instanceMap.set(serviceId as ServiceId, inst)
                    return inst
                } else {
                    if (this.parent) {
                        return this.parent.get(serviceId)
                    } else {
                        return null
                    }
                }
            }) as unknown) as () => T
            this.bindingMap.set(serviceId as ServiceId, lazyBinding as any)
        }
        return lazyBinding
    }
    get<T>(serviceId: ServiceId<T>): () => T | null {
        const res = this.bindingMap.get(serviceId as ServiceId)
        if (!res) {
            throw new Error("Cannot resolve service: " + serviceId.name)
        }
        return res as unknown as () => T
    }
}

let GlobalContainer: null | IInstantiationService = null

export const IInstantiationService = createServiceId<IInstantiationService>("Instantiation", () => {
    if (!GlobalContainer) {
        GlobalContainer = new InstantiationService()
    }
    return GlobalContainer
})
