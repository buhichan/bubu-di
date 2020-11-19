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
    provide<T, Args extends any[]>(serviceId: ServiceId<T>, impl: new (...args: Args) => T, ...args: Args) {
        return (node: React.ReactNode) => {
            node = <serviceId.context.Provider value={this.registerService(serviceId, impl, args)}>{node}</serviceId.context.Provider>
            return <>{node}</>
        }
    }
    private instanceMap = new Map<ServiceId, unknown>()
    private bindingMap = new Map<ServiceId, () => unknown>()
    dispose() {
        for (const inst of this.instanceMap.values()) {
            ;(inst as IDisposable).dispose?.()
        }
    }
    registerService<T, Arg extends any[]>(serviceId: ServiceId<T>, Impl: new (...args: Arg) => T, args: Arg) {
        let lazyBinding = (this.bindingMap.get(serviceId as ServiceId) as unknown) as () => T | null
        if (!lazyBinding) {
            lazyBinding = function (this: InstantiationService): T | null {
                //STEP1 尝试使用现有实例
                const maybeInst = (this.instanceMap.get(serviceId as ServiceId) as unknown) as T
                if (maybeInst) {
                    return maybeInst
                }
                //STEP2 构造
                /*
                 * 在proto上临时设置injector以给constructor里提供injector
                 */
                Impl.prototype[CURRENT_INJECTOR] = this
                const inst = (new Impl(...args) as unknown) as IDisposable & { [CURRENT_INJECTOR]: InstantiationService }
                delete Impl.prototype[CURRENT_INJECTOR]
                inst[CURRENT_INJECTOR] = this
                this.instanceMap.set(serviceId as ServiceId, inst)
                return (inst as unknown) as T
            }
            lazyBinding = lazyBinding.bind(this)
            this.bindingMap.set(serviceId as ServiceId, lazyBinding)
        }
        return lazyBinding
    }
    get<T>(serviceId: ServiceId<T>): () => T | null {
        const res = this.bindingMap.get(serviceId as ServiceId) as null | (() => T | null)
        if (res) {
            return res
        } else if (this.parent) {
            return this.parent.get(serviceId) || InstantiationService.NOOP
        } else {
            return InstantiationService.NOOP
        }
    }
    private static NOOP = () => null
}
