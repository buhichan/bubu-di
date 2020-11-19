
# Intro

A lightweight dependency injection lib for react.
- Typescript friendly 
    - You should depend on interface, not on implementation or runtime typings.
- Zero dependency 
    - Does not depend on reflect-metadata.
- Automatic instance creation and destruction based on react lifecycles.
- When injecting service, support both class property decorator injection and react-hook injection.

一个轻量级的react di库
- Typescript 友好
    - 你终于可以依赖interface来注入了, 而不是依赖实现或者其他什么运行时类型信息.
- 零依赖 
    - 甚至不依赖reflect-metadata
- 跟组件生命周期同步的实例自动创建和销毁
- 注入服务的时候, 既支持类属性装饰器, 又支持react-hook

# Usage

把大象装冰箱有3步, 用bubu-di在react项目引入依赖注入却有4步.

## Step1 创建一个接口

```ts
import {createServiceId} from "bubu-di"
interface IA {
    a():string
}
export const IA = createServiceId<IA>("A")

interface IB {
    b():string
}
export const IB = createServiceId<IB>("B")

```

## Step2 实现这个接口

```ts
// b.ts
import {inject} from "bubu-di"

class AImpl extends IA {
    a(){
        return "hello world"
    }
}

class BImpl implements IB {
    //凡是由bubu-di来实例化的服务, 都可以注入别的由bubu-di实例化的服务, 例如
    @inject(IA)
    a: IA

    b(){
        return "hello"+ this.a.a()
    }
}
```

## Step3 在组件树上某个节点提供这个接口的实现

注意这个pipe函数, bubu-di并不提供, 需要引入别的或者自己实现. 很多库都有类似函数, 例如redux的`compose()`也可以, 但是`compose`跟`pipe`顺序是相反的, 如果同一个里存在相互依赖需要注意这一点.

```tsx
import {use} from "bubu-di"
import {pipe} from "rxjs"
import {useService, IInstantiationService} from "bubu-di"
import {IA,IB} from "interface"
import {AImpl} from "a"
import {BImpl} from "b"

export function ServiceRegistry({children}:{children?:React.ReactNode}){

    const container = useService(IInstantiationService)

    return pipe(
        container.provide(IA, AImpl, {aOption1: "bar"}),
        container.provide(IB, BImpl),
    )(children)
}


// somewhere else:
// Main 组件及其下面所有子孙组件中就能注入IA和IB了
function App(){
    return <ServiceRegistry>
        <Main />
    </ServiceRegistry>
}
```

## Step4 在需要用到服务接口的地方, 按接口注入依赖

```tsx
import {IB} from "interfaces"
import {useService} from "bubu-di"

function C(){
    const b = useService(IB)
    return <div>{b.b()}</div>
}
```

或者在第2步中提到的一样, 在服务之间互相注入.

## Bonus 覆盖实现

你可以在一个子树中覆盖某些接口的具体实现, 没有被覆盖的接口会继承父树提供的实现.

```tsx
class AlternativeA implments IA {
    a(){
        return "f*** this world"
    }
}

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
        //由于IB依赖IA, 必须重新explicitly提供IB, 不然就会复用父级的IB
        //explicit is better than implicit
        subContainer.provide(IB, BImpl),
    )(children)

}

function SomeSubRouteChild(){

    const a = useService(IA) // here a is an instance of "AlternativeA"

    const b = useService(IB) // if IInstantiationService cannot find a service registry, it will bubble up to its parent node, which will return an instance of BImpl

    return <div></div>
}
```

# Thanks

- The injector idea comes from [react-ioc](https://github.com/gnaeus/react-ioc)
- The service id idea comes from [vscode](https://github.com/Microsoft/vscode)