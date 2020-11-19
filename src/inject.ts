import { ServiceId } from "./service"
import { IInstantiationService } from "./instantiation-service"
import * as React from "react"

export const CURRENT_INJECTOR = Symbol("CurrentInjector")

export class InjectorResolutionError extends Error {
    constructor(public cause: string) {
        super(`Injector resolution erro: ${cause}`)
    }
}

export function inject<T>(serviceId: ServiceId<T>) {
    return function (proto: unknown, propName: string) {
        Object.defineProperty(proto, propName, {
            get() {
                let injector = (this as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                if (!injector) {
                    injector = (proto as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                }
                if (!injector) {
                    throw new InjectorResolutionError("Please only use @inject when service is instantialized by InstantiationService.")
                }
                const res = injector.get(serviceId)()
                if (!res) {
                    throw new ServiceResolutionError(serviceId.name)
                }
                return res
            },
        })
    }
}

export function injectOptional<T>(serviceId: ServiceId<T>) {
    return function (proto: unknown, propName: string) {
        Object.defineProperty(proto, propName, {
            get() {
                let injector = (this as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                if (!injector) {
                    injector = (proto as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                }
                if (!injector) {
                    return null
                }
                return injector.get(serviceId)()
            },
        })
    }
}

export class ServiceResolutionError extends Error {
    constructor(public cause: string) {
        super(`未能解析的服务: ${cause.toString()}`)
    }
}

export function useServiceOptional<T>(serviceId: ServiceId<T>): T | null {
    return React.useContext(serviceId.context)()
}

/**
 * 依赖一个服务, 需要在useService的上层组件去provide才能成功获取到服务实例.
 * @param serviceId 通过createServiceId创造的服务ID
 */
export function useService<T>(serviceId: ServiceId<T>): T {
    const service = useServiceOptional(serviceId)
    if (!service) {
        throw new ServiceResolutionError(serviceId.name)
    }
    return service
}
