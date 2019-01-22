## picgo-plugin-pic-migrater

A PicGo plugin for pictures in markdown files migrating from one picBed to another one.

## Features

1. **This plugin can be used in [CLI](https://github.com/PicGo/PicGo-Core) & [GUI](https://github.com/Molunerfinn/PicGo) version of PicGo!**
2. It supports absolute and relative path of images, and the url path of images.

For example, a `test.md`:

```md
![](./js.jpg)
![](http://xxx.com/js.jpg)
```

if you choose `imgur` as your migrated picBed, after migrating:

```md
![](https://i.imgur.com/xxx.jpg)
![](https://i.imgur.com/xxxx.jpg)
```

## Installation

### CLI

```bash
picgo install pic-migrater
```

Then `pic-migrater` will registe a command named `migrate`.

### GUI

> search for pic-migrater

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/pic-migrater.png)

## Configuration

Please configurate this plugin first!

### CLI

After migrating, a new markdown file will be written in the same folder. But you should configurate this new file name's prefix:

```bash
picgo set plugins pic-migrater
```

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/CLI-prefix.png)

For example, if your origin file named `2019.md` & if you set the `newFilePrefix` to `_new`, then after migrating, a new file named `2018_new.md` will be created.

### GUI

After migrating, a new markdown file will be written in the same folder. But you should configurate this new file name's prefix:

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/GUI-prefix.png)

For example, if your origin file named `2019.md` & if you set the `newFilePrefix` to `_new`, then after migrating, a new file named `2018_new.md` will be created.

## Usage

### CLI


```bash
$ picgo migrate -h
Usage: migrate [options] <files...>

migrating pictures url from markdown files

Options:
  -h, --help  output usage information

Note:
You should configurate this plugin first!
picgo set plugin pic-migrater

Examples:

  # migrate file or files
  $ picgo migrate ./test.md ./test1.md

  # migrate markdown files in folder
  $ picgo migrate ./test/
```

### GUI

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/pic-migrater-gui.png)

## Thanks

Thanks to [@Moyf](https://github.com/Moyf) with the python version of this plugin.