# -*- coding: utf-8 -*-
import os, re  

input_md = "test.md"
file_name = re.match(r'(.*)\.md', input_md).group(1)

def readMarkdownFile(md):
    with open(md, 'r', encoding='UTF-8') as md_file:
        md_data = md_file.read()
        print(type(md_data))
    
    return md_data

# execute command, and return the output  
def execCmd(cmd):  
	r = os.popen(cmd)  
	text = r.read()  
	r.close()
	return text  

# write "data" to file-filename  
def writeFile(filename, data):  
	f = open(filename, "w")  
	f.write(data)  
	f.close()  

def recode(text):
	coded = text.decode('gb2312')#.encode('utf-8')
	return coded

def uploadImgs(imglist):
	urls = []
	url_pat = "http.*"
	
	for i in imglist:
		cmd = "picgo upload %s" % i
		result = execCmd(cmd)
		# 打印命令行的运行结果
        # print (result)
		
		url = re.findall(url_pat, result)[0]
		
		urls.append(url)
		# print ('Added %s' % url)
	
	return urls
	

if __name__ == '__main__':
    img_list = []
    all_text = readMarkdownFile(input_md)
    
	# uploaded_urls = uploadImgs(img_list)
    

    img_pat = r"\!\[(.*)\]\((.*\.(png|jpg|jpeg|gif))\)"
    img_matches = re.finditer(img_pat, all_text, re.MULTILINE)

    # 首先，判断有多少个匹配结果
    for matchNum, match in enumerate(img_matches, start=1):
#        print ("Match {matchNum} was found at {start}-{end}: {match}\
#               ".format(matchNum = matchNum, start = match.start(),
#               end = match.end(), match = match.group()))
        
        # 其次，判断每个匹配结果中有几个子匹配
        for groupNum in range(0, len(match.groups())):
            groupNum = groupNum + 1
            
            # 根据这个检索语法（来自 regex101.com）
            # 生成的第二组匹配正好是完整的图片路径
            if (groupNum == 2):
                img_path = match.group(groupNum)
                img_list.append(img_path)
                print ("Find {img} in MD File".format(img=img_path))
                
#            print ("Group {groupNum} found at {start}-{end}: {group}\
#                   ".format(groupNum = groupNum, start = match.start(groupNum),
#                   end = match.end(groupNum), group = match.group(groupNum)))

    # 开始上传图片...
    uploaded_urls = uploadImgs(img_list)
    # uploaded_urls = ['1', '2']
    
    # 开始替换原文件的内容
    new_md_data = all_text
    for i in range(0, len(img_list)):
        # 将原图片路径替换成新的 url
        new_md_data = re.sub(img_list[i], uploaded_urls[i], new_md_data)
    
    new_file_name = ('%s_uploaded.md' % file_name)
    
    # 将更改后的内容写入新文件（源文件留作存档）
    with open(new_file_name, 'w', encoding='UTF-8') as new_md_file:
        new_md_file.write(new_md_data)
    
    print (new_md_data)
