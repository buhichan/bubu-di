import "jest"
import { Simulate, act } from "react-dom/test-utils"
import { render } from "react-dom"
import * as React from "react"
import { createServiceId, IInstantiationService, inject, injectOptional, InstantiationService, useService, useServiceOptional } from "../src"

function pipe<F extends readonly Function[]>(...f: F) {
    return (...args: any[]) => {
        const res = f.reduceRight((args, func) => {
            return [func(...args)]
        }, args)
        return res[0]
    }
}

describe("basic test", () => {
    interface IA {
        a(): string
    }
    const IA = createServiceId<IA>("IA")

    interface IB {
        b(): string
    }
    const IB = createServiceId<IB>("IB")
    
    interface IC {
        c(): string
    }
    const IC = createServiceId<IC>("IC")

    class AImpl implements IA {
        a() {
            return "world"
        }
    }

    class BImpl implements IB {
        @inject(IA)
        //@ts-ignore
        a!: IA

        @injectOptional(IC)
        //@ts-ignore
        c!: IC

        b() {
            return (this.c == null ? "" : "???") + "hello " + this.a.a()
        }
    }

    class AAlternative implements IA {
        a() {
            return "you guys"
        }
    }
    const rootEl = document.createElement("div")
    document.body.appendChild(rootEl)

    beforeEach(() => {
        function Root({}: {}) {
            const containerService = React.useMemo(() => new InstantiationService(), [])

            return (
                <>
                    {pipe(
                        //prettier-ignore
                        containerService.provide(IA, AImpl),
                        containerService.provide(IB, BImpl)
                    )(
                        <>
                            <Child />
                        </>
                    )}
                    <Orphan />
                    <Stranger />
                </>
            )
        }

        function Child() {
            const b = useService(IB)

            const newContainerNode = InstantiationService.useNewNode()

            return (
                <div>
                    Child says: <div id="child">{b.b()}</div>
                    {
                        //prettier-ignore
                        pipe(
                            newContainerNode.provide(IA, AAlternative), 
                            newContainerNode.provide(IB, BImpl)
                        )(<GrandChild />)
                    }
                </div>
            )
        }

        function GrandChild() {
            const b = useService(IB)
            return (
                <div>
                    GrandChild says: <div id="grandchild">{b.b()}</div>
                </div>
            )
        }

        function Orphan() {
            try {
                const b = useService(IB)
            } catch (err) {
                return null
            }
            return <div id="orphan">Orphan</div>
        }

        function Stranger() {
            try {
                const b = useServiceOptional(IB)
            } catch (err) {
                return null
            }
            return <div id="stranger">Stranger</div>
        }

        render(<Root />, rootEl)
    })

    it("should work", () => {
        const child = document.querySelector("#child")!
        expect(child).toBeTruthy()
        expect(child.innerHTML).toBe("hello world")
    })

    it("should overwrite on subtrees", () => {
        const child = document.querySelector("#grandchild")!
        expect(child).toBeTruthy()
        expect(child.innerHTML).toBe("hello you guys")
    })

    it("should leave other tree untouched", () => {
        const child = document.querySelector("#orphan")!
        expect(child).toBeFalsy()
    })

    it("should silently return null when useServiceOptional cannot resolve service", () => {
        const child = document.querySelector("#stranger")!
        expect(child).toBeTruthy()
    })
})
