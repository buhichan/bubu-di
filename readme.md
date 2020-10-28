

# usage

```tsx

//interfaces.ts
import {createServiceId} from "bubu-di"
interface IA {
    a():string
}
export const IA = createServiceId<IA>("A")

interface IB {
    b():string
}
export const IB = createServiceId<IB>("B")

//a.ts
class AImpl implements IA {
    a(){
        return "world"
    }
}

// b.ts
import {inject} from "bubu-di"

class BImpl implements IB {
    @inject(IA)
    a: IA

    b(){
        return "hello"+ this.a.a()
    }
}

// c.ts
import {IB} from "interfaces"
import {useService} from "bubu-di"

function C(){
    const b = useService(IB)
    return <div>{b.b()}</div>
}

// in app root: 

function App(){
    return <ServiceRegistry>
        <Main />
    </ServiceRegistry>
}

// service-registry.ts
import {pipe} from "rxjs"
import {useService, IInstantiationService} from "bubu-di"
import {IA,IB} from "interface"
import {A} from "a"
import {B} from "b"

export function ServiceRegistry({children}:{children?:React.ReactNode}){

    const container = useService(IInstantiationService)

    return pipe(
        container.provide(IA, A),
        container.provide(IB, B),
    )(children)
}

// you can also provide different service in sub route: 

function SomeSubRoute(){
    return <SomeSubRouteServiceRegistry>
        <SomeSubRouteChild />
    </SomeSubRouteServiceRegistry>
}

export function SomeSubRouteServiceRegistry({children}:{children?:React.ReactNode}){

    const container = useService(IInstantiationService)

    const subContainer = container.useNewNode()

    return pipe(
        subContainer.provide(IA, AlternativeA),
    )(children)

}

function SomeSubRouteChild(){

    const a = useService(IA) // here a is an instance of "AlternativeA"

    const b = useService(IB) // if IInstantiationService cannot find a service registry, it will bubble up to its parent node, which will return an instance of BImpl

    return <div></div>
}

```