import { ServiceId } from "./service"
import { IInstantiationService } from "./instantiation-service"
import * as React from "react"

export const CURRENT_INJECTOR = Symbol("CurrentInjector")

export class InjectorResolutionError extends Error {
    constructor(public cause: string) {
        super(`Injector resolution erro: ${cause}`)
    }
}

type InjectOptions = {
    optional?: boolean
}

const RESOLVE_CACHE = Symbol("RESOLVE_CACHE")

function resolveInstance<T>(classInst: unknown, serviceId: ServiceId<T>, injector: IInstantiationService, options?: InjectOptions): T | null {
    let cache = ((classInst as unknown) as Record<typeof RESOLVE_CACHE, Map<ServiceId<T>, T | null>>)[RESOLVE_CACHE]
    if (!cache) {
        cache = new Map()
        Object.defineProperty(classInst, RESOLVE_CACHE, {
            enumerable: false,
            value: cache,
        })
    }
    let res = cache.get(serviceId)
    if (res !== undefined) {
        return res
    }
    if (!injector && !options?.optional) {
        throw new InjectorResolutionError("Please only use @inject when service is instantialized by InstantiationService.")
    }
    res = injector.get(serviceId)()
    if (!res) {
        if (!options?.optional) {
            throw new ServiceResolutionError(serviceId.name)
        }
    }
    cache.set(serviceId, res)
    return res
}

export function inject<T>(serviceId: ServiceId<T>, options?: InjectOptions) {
    return function (proto: unknown, propName: string) {
        Object.defineProperty(proto, propName, {
            get() {
                let injector = (this as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                if (!injector) {
                    injector = (proto as Record<typeof CURRENT_INJECTOR, IInstantiationService>)[CURRENT_INJECTOR]
                }
                return resolveInstance<T>(this, serviceId, injector, options)
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
