import * as React from "react"

export type ServiceId<T = unknown> = {
    name: string
    context: React.Context<() => T | null>
}

export type ProvideAndInst<T> = [ServiceId<T>, () => T]

/**
 * 创建一个服务ID, 用于表示一个抽象的服务和它对应的接口,
 * 要依赖这个接口, 请使用useService(serviceId)
 * 要提供一个接口的实现, 请使用useProvider
 * 如果使用了useService而没有在父级提供则会抛出异常, 如果要可选地使用一个服务, 请使用useServiceOptional
 * 下面是例子
 * @example
 * ```typescript
 *
 * interface IHttpService {
 *     get<T>(path:string, params: Record<string,string | string[]>):Observable<T>
 * }
 *
 * class HttpService implements IHttpService {
 *     get<T>(path:string, params: Record<string,string | string[]>):Observable<T>{
 *          return fromFetch(path + (new URLSearchParams(params)).toString()).pipe(
 *              switchMap(res=>res.json())
 *          )
 *     }
 * }
 *
 * //请让这个变量与其代表的接口同名
 * const IHttpService = createServiceId<IHttpService>("HttpService")
 *
 * function ParentComponent(){
 *      //useProvider是一个react-hook, 返回一个函数, 函数唯一参数是需要提供此服务的children node.
 *      return useProvider(
 *          [IHttpService, HttpService]
 *      )(<ChildComponent />)
 * }
 *
 * function ChildComponent(){
 *      const service = useService(IHttpService)
 *      const [data] = useObservable(()=>{
 *          return service.get("/api")
 *      },[])
 * }
 * ```
 * @param name
 */
export function createServiceId<T>(name: string, defaultValue?: () => T): ServiceId<T> {
    return {
        name,
        context: React.createContext<() => T | null>(defaultValue || (() => null)),
    }
}
