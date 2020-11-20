import "jest"
import { Simulate, act } from "react-dom/test-utils"
import { render, unmountComponentAtNode } from "react-dom"
import * as React from "react"
import { createServiceId, IDisposable, IInstantiationService, inject, InstantiationService, useService, useServiceOptional } from "../src"
import { InjectorResolutionError, ServiceResolutionError } from "../src/inject"

function pipe<F extends readonly Function[]>(...f: F) {
    return (...args: any[]) => {
        const res = f.reduceRight((args, func) => {
            return [func(...args)]
        }, args)
        return res[0]
    }
}

describe("basic usage", () => {
    const referenceCount = {
        A: new Set(),
        B: new Set(),
        AAlter: new Set(),
        C: new Set(),
        clear() {
            referenceCount.A.clear()
            referenceCount.B.clear()
            referenceCount.AAlter.clear()
            referenceCount.C.clear()
        },
    }

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
    interface ID {
        d(): string
    }
    const ID = createServiceId<IC>("ID")

    class AImpl implements IA, IDisposable {
        constructor() {
            referenceCount.A.add(this)
        }
        dispose() {
            referenceCount.A.delete(this)
        }
        a() {
            return "world"
        }
    }

    class BImpl implements IB, IDisposable {
        @inject(IA)
        //@ts-ignore
        a!: IA

        @inject(IC, { optional: true })
        //@ts-ignore
        c: IC | null

        @inject(ID, { optional: true })
        //@ts-ignore
        d: ID | null
        constructor() {
            referenceCount.B.add(this)
            //@ts-ignore
            const c = this.c
            this.cSays = c?.c() || "c is not injected"
        }
        dispose() {
            referenceCount.B.delete(this)
        }
        cSays: string

        b() {
            if (this.d) {
                return "d should be null"
            }
            return "hello " + this.a.a()
        }
    }

    class CImpl implements IC, IDisposable {
        constructor() {
            referenceCount.C.add(this)
        }
        c() {
            return "this is c"
        }
        dispose() {
            referenceCount.C.delete(this)
        }
    }

    class AAlternative implements IA {
        constructor() {
            referenceCount.AAlter.add(this)
        }
        dispose() {
            referenceCount.AAlter.delete(this)
        }
        a() {
            return "you guys"
        }
    }
    const rootEl = document.createElement("div")
    document.body.appendChild(rootEl)

    beforeEach(() => {
        function Root({}: {}) {
            const containerService = React.useMemo(() => new InstantiationService(), [])

            const [showChild, setShowChild] = React.useState(true)

            return (
                <>
                    {pipe(
                        //prettier-ignore
                        containerService.provide(IInstantiationService, InstantiationService), //self-provide
                        containerService.provide(IA, AImpl),
                        containerService.provide(IB, BImpl),
                        containerService.provide(IC, CImpl)
                    )(
                        <>
                            <button id="toggle-child" onClick={() => setShowChild(false)}>
                                1
                            </button>
                            {showChild ? <Child /> : null}
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

    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        referenceCount.clear()
        jest.runOnlyPendingTimers()
        jest.useRealTimers()

        unmountComponentAtNode(rootEl)
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

    it("should create correct number of instances", () => {
        jest.runAllTimers()
        expect(referenceCount.A.size).toBe(1)
        //B Should have 2 instance, one use A, one use AAlter
        expect(referenceCount.B.size).toBe(2)
        expect(referenceCount.AAlter.size).toBe(1)
        expect(referenceCount.C.size).toBe(1)
    })

    it("should destroy instances when provider node unmount", () => {
        act(() => {
            const el = document.querySelector("#toggle-child")!
            Simulate.click(el, {})
        })
        jest.runAllTimers()

        expect(referenceCount.A.size).toBe(1)
        expect(referenceCount.B.size).toBe(1)
        expect(referenceCount.AAlter.size).toBe(0)
        expect(referenceCount.C.size).toBe(1)
    })

    it("should handle dependency injection usage in constructor", () => {
        const bInst = referenceCount.B.values().next().value!
        expect((bInst as BImpl).cSays).toBe("this is c")
    })

    it("should provide default container", () => {
        const el2 = document.createElement("div")
        document.body.appendChild(el2)

        function Test() {
            const s = useService(IInstantiationService)

            return <div>{s === null ? "null" : "container"}</div>
        }

        act(() => {
            render(<Test />, el2)
        })

        expect(el2.innerHTML).toBe("<div>container</div>")

        document.body.removeChild(el2)
    })

    it("should throw error when used incorrectly 1", () => {
        //case 1
        let err = null
        try {
            class BAlter implements IB {
                b() {
                    return this.a.a()
                }
                @inject(IA)
                //@ts-ignore
                a: IA
            }
            const b = new BAlter()
            b.b()
        } catch (err1) {
            err = err1
        }
        expect(err).toBeInstanceOf(Error)
    })

    it("should throw error when used incorrectly 2", () => {
        //case 2
        let err = null

        const el2 = document.createElement("div")
        document.body.appendChild(el2)

        function Test() {
            try {
                const s = useService(IA)

                return <div>{s === null ? "null" : "container"}</div>
            } catch (err1) {
                err = err1
                return null
            }
        }

        act(() => {
            render(<Test />, el2)
        })

        //@ts-ignore
        expect(err).toBeInstanceOf(Error)

        document.body.removeChild(el2)
    })
})
