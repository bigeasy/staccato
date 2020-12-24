
const value = await object.get()


const trampoline = object.get()
while (trampoline.seek()) {
    await trampoline.shift()
}
const value = trampline.value

class Service {
    get (key) {
        const trampoline = new Trampoline
        const got = this._cache[key]
        if (got == null) {
            return trampoline.promise(async () => {
                const got = await this._load(key)
                this._cache[key] = got
                return trampoline.resolve(got)
            })
        }
        return trampoline.resolve(got)
    }
}
