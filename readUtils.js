class ViewReader {
    constructor(buffer, littleEndian = true) {
        this.view = new DataView(buffer)
        this.uint8Array = new Uint8Array(buffer)
        this.pos = 0
        this.littleEndian = littleEndian
        this.lookback = {
            version: null,
            encountered: false,
            list: [],
        }
    }

    skip(n) {
        this.pos += n
    }

    toUtf8(uint8array) {
        return new TextDecoder("utf-8").decode(uint8array)
    }

    readNodeRef() {
        let index = this.readUInt32()
        let classId = null
        let readNode = false
        if (index >= 0) {
            console.warn('not fully implemented, node must be read now!')
            classId = this.readUInt32()
            readNode = true
        }
        return { index, classId, readNode }
    }

    readFileRef() {
        let version = this.readByte()
        let checkSum = null
        if (version >= 3) {
            checkSum = this.readStringOfLength(32)
        }
        let filePath = this.readString()
        let locatorUrl = null
        if (filePath.length > 0 && version >= 1) {
            locatorUrl = this.readString()
        }

        return { checkSum, locatorUrl, filePath, version }
    }

    readMeta() {
        let id = this.readLookbackString()
        let collection = this.readLookbackString()
        let author = this.readLookbackString()
        return { id, collection, author }
    }

    resetLookback() {
        this.lookback = {
            version: null,
            encountered: false,
            list: [],
        }
    }

    readLookbackString() {
        if (this.lookback.encountered === false) {
            this.lookback.version = this.readUInt32()
            console.log("first lookback encountered, version: ", this.lookback.version)
        }
        this.lookback.encountered = true
        let indexData = this.readUInt32().toString(2).padStart(32, '0')
        let flags = indexData.substr(0, 2).split('').reverse().join('')
        let indexIsNumber = flags === '00'
        let index = parseInt(indexData.substr(2), 2)
        console.log('lookback index uint32: ', indexData, index)
        if (indexIsNumber) {
            // use global string table 
            let value = collections[index]?.collection ?? "Unknown"
            console.log('global cached value =', value)
            return value
        }
        if (index === 0) {
            let newString = this.readString()
            console.log('newString value =', newString)
            this.lookback.list.push(newString)
            return newString
        } else {
            let value = this.lookback.list[index - 1]
            if (value === null || value === undefined) {
                if (flags[0] === '1')
                    return -1
                if (flags[1] === '1')
                    return 'Unassigned'
            } else {
                console.log('cached string value =', value)
                return value
            }
        }
    }

    readVec2() {
        let x = this.readFloat()
        let y = this.readFloat()
        return { x, y }
    }

    readVec3() {
        let x = this.readFloat()
        let y = this.readFloat()
        let z = this.readFloat()
        return { x, y, z }
    }

    readColor() {
        let r = this.readFloat()
        let g = this.readFloat()
        let b = this.readFloat()
        return { r, g, b }
    }

    readString() {
        let length = this.readUInt32()
        return this.readStringOfLength(length)
    }

    readStringOfLength(length) {
        let bytes = this.readBytes(length)
        return this.toUtf8(bytes)
    }

    readBytes(length) {
        if (length === undefined) throw new Error('You must give a length')
        let bytes = this.uint8Array.slice(this.pos, this.pos + length)
        this.pos += length
        return bytes
    }

    readFromView(type, size) {
        let result = this.view['get' + type](this.pos, this.littleEndian)
        this.pos += size
        return result
    }

    readInt32() {
        return this.readFromView('Int32', 4);
    }

    readInt16() {
        return this.readFromView('Int16', 2);
    }

    readInt8() {
        return this.readFromView('Int8', 1);
    }

    readByte() {
        return this.readUInt8();
    }

    readBool() {
        return this.readFromView('Uint32', 4) === 1
    }

    readFloat() {
        return this.readFromView('Float32', 4)
    }

    readUInt128() {
        let a = this.readUInt64().toString(2)
        let b = this.readUInt64().toString(2)
        let binaryString = this.littleEndian ? a + b : b + a
        return BigInt('0b' + binaryString)
    }

    readUInt64() {
        return this.readFromView('BigUint64', 8)
    }

    readUInt32() {
        return this.readFromView('Uint32', 4)
    }

    readUInt16() {
        return this.readFromView('Uint16', 2)
    }

    readUInt8() {
        return this.readFromView('Uint8', 1)
    }
}