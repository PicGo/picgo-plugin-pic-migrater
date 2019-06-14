## picgo-plugin-pic-migrater

[![PicGo Convention](https://img.shields.io/badge/picgo-convention-blue.svg?style=flat-square)](https://github.com/PicGo/bump-version)

一个能将你markdown文件里的图片从一个地方迁移到另外一个图床的PicGo插件。

## 特性

1. **这个插件既可以被用在 [命令行](https://github.com/PicGo/PicGo-Core) 版本的PicGo里也可以用在 [GUI](https://github.com/Molunerfinn/PicGo) 版本的PicGo里!**
2. 它迁移支持本地相对路径或者绝对路径的图片，也支持迁移远端URL的图片。

举个例子，我们手上有一个 `test.md`:

```md
![](./js.jpg)
![](http://xxx.com/js.jpg)
```

如果你选择了 `imgur` 作为你的默认图床, 那么迁移过后:

```md
![](https://i.imgur.com/xxx.jpg)
![](https://i.imgur.com/xxxx.jpg)
```

## 安装

### 命令行

```bash
picgo install pic-migrater
```

安装之后 `pic-migrater` 会注册一个叫做 `migrate` 的命令。

### GUI

> 在插件设置页面搜索插件

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/pic-migrater.png)

## 配置

使用之前请配置一下插件！

因为在迁移某个markdown文件里的图片之后会在同一个文件夹里生成一个新的markdown文件（防止原本文件丢失）。所以你要配置一下这个新的文件的文件名后缀。

### 命令行

```bash
picgo set plugin pic-migrater
```

### GUI

打开插件配置页面，找到`pic-migrator`的右下角配置按钮，点击`配置`。

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/GUI-prefix.png)

### 配置详情

#### newFileSuffix

> 新文件名的后缀

![](https://raw.githubusercontent.com/Molunerfinn/test/master/test/CLI-prefix.png)

举个例子，如果你原本的文件名为 `2019.md` 并且你将 `newFileSuffix` 设置成 `_new`，那么迁移过后，将会生成一个叫做 `2019_new.md` 的新文件。

#### include

> 只包含

如果你配置了 `include` 字段，那么migrator只会迁移包含这个字段值的图片地址。

举个例子，如果你将 `include` 配置为 `sinaimg.cn`，那么migrator只会迁移那些URL或者路径里带有`sinaimg.cn`字符串的图片。

#### exclude

> 不包含

如果你配置了 `exclude` 字段，那么migrator将不会迁移包含这个字段值的图片地址。

举个例子，如果你将 `exclude` 配置为 `sinaimg.cn`，那么migrator不会迁移那些URL或者路径里带有`sinaimg.cn`字符串的图片。

## 使用方法

### 命令行

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

## 感谢

感谢 [@Moyf](https://github.com/Moyf) 提供了本插件最初的python版本的构想。