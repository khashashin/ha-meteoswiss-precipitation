export function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
    let inThrottle: boolean;
    let lastFunc: ReturnType<typeof setTimeout>;
    let lastRan: number;

    return function (this: any, ...args: any[]) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    } as T;
}
