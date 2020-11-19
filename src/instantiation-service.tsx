import * as React from "react"
import { createServiceId, ServiceId } from "./service"
import { CURRENT_INJECTOR } from "./inject"

export interface IDisposable {
    dispose(): void
}

export interface IInstantiationService extends IDisposable {
    readonly parent?: IInstantiationService
    createNewNode(): IInstantiationService
    get<T>(serviceId: ServiceId<T>): () => T | null
    provide<T, Args extends any[]>(serviceId: ServiceId<T>, impl: new (...args: Args) => T, ...args: Args): (node: React.ReactNode) => React.ReactElement
}

let GlobalContainer: null | IInstantiationService = null

export const IInstantiationService = createServiceId<IInstantiationService>("Instantiation", () => {
    if (!GlobalContainer) {
        GlobalContainer = new InstantiationService()
    }
    return GlobalContainer
})

export class InstantiationService implements IInstantiationService {
    constructor(public parent?: IInstantiationService) {}
    createNewNode() {
        const child = new InstantiationService(this)
        child.bindingMap = new Map(this.bindingMap) //just clone it.
        return child
    }
    static useNewNode(): IInstantiationService {
        const parent = React.useContext(IInstantiationService.context)
        const inster = React.useMemo(() => {
            let inst = parent()?.createNewNode()
            if (!inst) {
                return new InstantiationService() as InstantiationService
            } else {
                return inst
            }
        }, [])
        React.useEffect(
            () => () => {
                inster?.dispose()
            },
            []
        )
        return inster
    }
    private static lazyBinding<T>(originContainer: InstantiationService, serviceId: ServiceId, Impl: new (...args: any[]) => T, args: any[]) {
        return (container: InstantiationService = originContainer): T | null => {
            if (container.instanceMap.has(serviceId)) {
                return (container.instanceMap.get(serviceId) as unknown) as T
            }
            /*
             * 在proto上临时设置injector以给constructor里提供injector
             */
            Impl.prototype[CURRENT_INJECTOR] = container
            const inst = (new Impl(...args) as unknown) as IDisposable & { [CURRENT_INJECTOR]: InstantiationService }
            delete Impl.prototype[CURRENT_INJECTOR]
            inst[CURRENT_INJECTOR] = container
            container.instanceMap.set(serviceId as ServiceId, inst)
            return (inst as unknown) as T
        }
    }
    provide<T, Args extends any[]>(serviceId: ServiceId<T>, impl: new (...args: Args) => T, ...args: Args) {
        return (node: React.ReactNode) => {
            node = <serviceId.context.Provider value={this.registerService(serviceId, impl, args)}>{node}</serviceId.context.Provider>
            return <>{node}</>
        }
    }
    private instanceMap = new Map<ServiceId, IDisposable & { [CURRENT_INJECTOR]: InstantiationService }>()
    private bindingMap = new Map<ServiceId, () => IDisposable & { [CURRENT_INJECTOR]: InstantiationService }>()
    dispose() {
        for (const inst of this.instanceMap.values()) {
            inst.dispose?.()
        }
    }
    registerService<T, Arg extends any[]>(serviceId: ServiceId<T>, Impl: new (...args: Arg) => T, args: Arg) {
        let lazyBinding = (this.bindingMap.get(serviceId as ServiceId) as unknown) as () => T
        if (!this.bindingMap.has(serviceId as ServiceId)) {
            lazyBinding = InstantiationService.lazyBinding(this, serviceId as ServiceId, (Impl as unknown) as new () => T, args) as () => T
            this.bindingMap.set(serviceId as ServiceId, lazyBinding as any)
        }
        return lazyBinding
    }
    get<T>(serviceId: ServiceId<T>): () => T | null {
        const res = this.bindingMap.get(serviceId as ServiceId)
        if (!res) {
            throw new Error("Cannot resolve service: " + serviceId.name)
        }
        return (res as unknown) as () => T
    }
}
